// Импортируем config
import { fadeIn, fadeOut, scaleUp, scaleDown } from "../../../config/animations.js";
import { CDM_Z_INDEX } from "../../../config/constants.js";

// Импортируем типы
import type { OverlayPreset } from "../types.js";

/**
 * ***************************************************************************
 * Пресет типа "popover" — слой, привязанный к элементу или к точке.
 *
 * Поповер — это то, что открывается «впритык» к месту действия: контекстное
 * меню по клику, панель эмодзи над полем ввода, меню бота. Отличие от диалога
 * не в оформлении, а в двух вещах:
 *
 * 1. **Якорь.** Только этот тип умеет позиционироваться относительно элемента
 *    или точки (`capabilities/popover_geometry`). Диалог и форма вставляются
 *    туда, куда сказали, и ничего не знают о соседних элементах.
 *
 * 2. **Реакция на нехватку места** (`fit`):
 *    - `"flip"` (по умолчанию) — перевернуться на другую сторону от якоря.
 *      Так ведут себя меню: список пунктов должен быть виден целиком.
 *    - `"shrink"` — ужаться и получить прокрутку. Так ведут себя большие
 *      панели (эмодзи, меню бота): переворачивать их под поле ввода нельзя,
 *      у них есть собственная внутренняя прокрутка.
 *
 * Про затемнение. У поповера оно по умолчанию выключено (`overlay: false`):
 * почти все его потребители — меню, которые открываются поверх живой формы,
 * и затемнение под ними просто закрывает то, ради чего меню и открывали.
 * Затемнение нужно только панелям, которые перекрывают интерфейс целиком
 * (эмодзи) — они просят `overlay: true` явно.
 *
 * Почему корневой класс не навешивается (`forceRootClass` не задан):
 * содержимое поповера разное — у меню это `<div class="cdm-context-menu">`,
 * у эмодзи это `<div class="cdm-modal emoji">` с собственными классами
 * из `CDM_MODAL_CLASSES()`. Пресет не должен решать за них, как они выглядят.
 */
export const popover: OverlayPreset = {

    /** @type {string} Имя типа. */
    name: "popover",

    /** @type {string} Селектор оверлея внутри обёртки. */
    overlaySelector: ".cdm-popover-overlay",

    /** @type {boolean} `onBeforeOpen`, вернувший false, отменяет открытие. */
    cancelOnBeforeOpen: false,

    /** @type {boolean} Ждать завершения `onOpen` перед регистрацией в навигации. */
    awaitOnOpen: false,

    /** @type {string[]} Капабилти этого типа. */
    capabilities: ["popover_geometry"],

    /**
     * Класс, которым помечаются пункты меню. По нему пресет понимает, что
     * кликнули по пункту, и закрывает поповер.
     * @type {string}
     */
    itemSelector: "[data-popover-item]",

    /**
     * Дефолты настроек поповера.
     */
    options: {
        url: null,
        insertInto: null,
        x: 0,
        y: 0,
        margin: 10,
        targetNode: null,
        targetNodeDirection: "bottom",
        fit: "flip",
        overlay: false,
        closeOnEsc: true,
        closeOnOverlay: true,
        onBeforeOpen: async () => { },
        onOpen: () => { },
        onBeforeClose: async () => { },
        onAfterClose: () => { }
    },

    /**
     * Шаблон обёртки.
     * @returns {HTMLElement} Разборный DOM-элемент обёртки.
     */
    template() {

        // Обёртка выше диалогов (`CDM_Z_INDEX.MODAL`): поповер открывается поверх
        // открытого диалога и не должен проваливаться под него
        const wrap = new DOMParser().parseFromString(`
            <div class="cdm-popover-wrap absolute flex p-4 inset-0 ${CDM_Z_INDEX.POPOVER} justify-center">
                <div class="cdm-popover-overlay absolute inset-0 flex"></div>
            </div>
        `, "text/html").querySelector(".cdm-popover-wrap");

        // invariant: шаблон — наши строки, обёртка в нём всегда есть
        if (!(wrap instanceof HTMLElement)) {
            throw new TypeError("popover: template: обёртка .cdm-popover-wrap не найдена");
        }

        return wrap;

    },

    /**
     * Дополнительная подготовка обёртки перед монтированием.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     */
    initWrap(popover) {

        // Затемнение включается явно: у меню его быть не должно
        if (popover.options.overlay) {
            popover.overlay?.classList.add("bg-[var(--modal-overlay-bg)]");
        }

        // Клик по пункту меню закрывает поповер — так же, как клик по затемнению.
        // Раньше это делал сам `ContextMenu` из обработчика пункта; теперь пункты
        // собираются ДО создания контейнера, и замыкание на `this` в них невозможно.
        //
        // Слушатель не снимается явно: он висит на `content`, а тот удаляется
        // из DOM вместе с обёрткой. Повторное открытие того же экземпляра
        // не поддерживается — все места вызова создают новый.
        if (popover.content) {
            popover.content.addEventListener("click", (event) => {
                // invariant: клик всегда исходит от элемента дерева документа
                if (!(event.target instanceof Element)) return;
                // Без селектора пунктов совпадений не бывает — закрывать нечего
                const itemSelector = popover.preset.itemSelector;
                if (itemSelector && event.target.closest(itemSelector)) {
                    popover.close();
                }
            });
        }

    },

    /**
     * Анимация контента при открытии.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     */
    openContentAnimation(popover) {
        if (!popover.content) return null;

        return popover.content.animate(scaleUp.animation, scaleUp.settings);
    },

    /**
     * Анимация оверлея при открытии.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     */
    openOverlayAnimation(popover) {
        if (!popover.overlay) return null;

        return popover.overlay.animate(fadeIn.animation, fadeIn.settings);
    },

    /**
     * Анимации при закрытии.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * @returns {Animation[]} Массив анимаций.
     */
    closeAnimations(popover) {
        if (!popover.content) return [];

        return [popover.content.animate(scaleDown.animation, scaleDown.settings)];
    },

    /**
     * Анимация оверлея при закрытии.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * @returns {Animation[]} Массив анимаций.
     */
    closeOverlayAnimations(popover) {
        if (!popover.overlay) return [];

        return [popover.overlay.animate(fadeOut.animation, fadeOut.settings)];
    },

    /**
     * Можно ли закрывать: проверяем, что оверлей ещё смонтирован.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * @returns {boolean} true, если есть что снимать с DOM.
     */
    canClose(popover) {
        return !!(popover.overlay && popover.overlay.parentNode);
    }

};