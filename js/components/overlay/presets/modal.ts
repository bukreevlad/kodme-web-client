// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем config
import { fadeIn, fadeOut, scaleUp, scaleDown } from "../../../config/animations.js";
import { CDM_Z_INDEX } from "../../../config/constants.js";

// Импортируем типы
import type { OverlayPreset } from "../types.js";

/**
 * ***************************************************************************
 * Пресет типа "modal" — диалог поверх формы.
 * ***************************************************************************
 *
 * Модалка — слой поверх всего: затемняет фон, центрируется, её нельзя закрыть
 * свайпом, но можно перетащить и растянуть.
 *
 * Привязки к элементу у модалки нет: то, что открывается рядом с кнопкой или
 * над полем ввода (меню, эмодзи), — это тип `popover`.
 *
 * Что пресет НЕ меняет по сравнению с `Form` и почему это важно:
 * - свои CSS-классы (`.cdm-modal-*`), своя `--modal-overlay-bg` (затемнение
 *   темнее, чем у форм) и свой `--modal-bg`;
 * - свой уровень слоя (`CDM_Z_INDEX.MODAL`): диалог обязан лежать выше любой
 *   формы. Всю лестницу держим в `js/config/constants.js`, чтобы порядок слоёв
 *   не пришлось восстанавливать по разным файлам;
 * - `centered`-обёртка (`justify-center`) и `wrapPadding` — отступ от краёв
 *   экрана живёт на обёртке, а не на самом окне;
 * - дефолтное появление `scaleUp`, в отличие от формы, у которой анимации
 *   появляются только при явном `openAnimationClass`.
 */
export const modal: OverlayPreset = {

    /** @type {string} Имя типа. */
    name: "modal",

    /** @type {string} Базовый класс, который вешается на контент. */
    rootClass: "cdm-modal",

    /** @type {string} Селектор оверлея внутри обёртки. */
    overlaySelector: ".cdm-modal-overlay",

    /**
     * Контент модалки приходит «как есть» — корневой класс навешиваем сами.
     * У формы он уже прописан в разметке шаблона.
     */
    forceRootClass: true,

    /** @type {boolean} `onBeforeOpen`, вернувший false, отменяет открытие. */
    cancelOnBeforeOpen: false,

    /** @type {boolean} Ждать завершения `onOpen` перед регистрацией в навигации. */
    awaitOnOpen: false,

    /** @type {string[]} Капабилти этого типа. */
    capabilities: ["window_geometry"],

    /**
     * Публичные методы типа, которых нет у других. Живут здесь, а не в
     * капабилти, потому что это часть контракта модалки, а не её поведения:
     * `forms/bot-app` дёргает их при разворачивании и сворачивании окна.
     */
    methods: {

        /**
         * ***************************************************************************
         * Динамически меняет CSS-классы отступов обёртки.
         * Отступ живёт на обёртке, а не на самом окне, — поэтому при
         * разворачивании окна на весь экран достаточно поменять класс.
         * @param {string} padding - Название CSS-класса отступов (например, `"p-6"`).
         * ***************************************************************************
         */
        setWrapPadding(padding) {
            // Обёртка создаётся при открытии: без неё менять отступы не на что
            const wrap = this.wrap;
            if (!wrap) return;

            if (this.options.wrapPadding) {
                wrap.classList.remove(this.options.wrapPadding);
            }
            this.options.wrapPadding = padding;

            if (padding) {
                wrap.classList.add(this.options.wrapPadding);
            }
        }

    },

    /**
     * Дефолты настроек модалки.
     */
    options: {
        url: null,
        insertInto: null,
        overlay: true,
        closeOnEsc: true,
        closeOnOverlay: true,
        overlayBlur: false,
        wrapPadding: "p-4",
        onBeforeOpen: async () => { },
        onOpen: () => { },
        onBeforeClose: async () => { },
        onAfterClose: () => { },
        openAnimationClass: null,
        closeAnimationClass: null,
        move: null,
        resize: false,
        // Диалог по определению модален: ловушка фокуса и возврат на триггер
        // включены по умолчанию (отключить можно опцией вызова)
        focusTrap: true,
        focusReturn: true
    },

    /**
     * ***************************************************************************
     * Шаблон обёртки.
     * @returns {HTMLElement} Разборный DOM-элемент обёртки.
     * ***************************************************************************
     */
    template() {

        const wrap = new DOMParser().parseFromString(`
            <div class="cdm-modal-wrap absolute flex inset-0 max-w-full max-h-full ${CDM_Z_INDEX.MODAL} justify-center">
                <div class="cdm-modal-overlay absolute inset-0 ${CDM_Z_INDEX.OVERLAY_BELOW} flex bg-[var(--modal-overlay-bg)]"></div>
            </div>
        `, "text/html").querySelector(".cdm-modal-wrap");

        // invariant: шаблон — наши строки, обёртка в нём всегда есть
        if (!(wrap instanceof HTMLElement)) {
            throw new TypeError("modal: template: обёртка .cdm-modal-wrap не найдена");
        }

        return wrap;

    },

    /**
     * ***************************************************************************
     * Дополнительная подготовка обёртки перед монтированием.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * ***************************************************************************
     */
    initWrap(modal) {

        // Отступ от краёв экрана живёт на обёртке, а не на самом окне:
        // так его можно менять на лету (`setWrapPadding`) без пересборки окна
        if (modal.wrap && modal.options.wrapPadding) {
            modal.wrap.classList.add(modal.options.wrapPadding);
        }

        // Выпадающие меню приходят без затемнения
        if (!modal.options.overlay && modal.overlay) {
            modal.overlay.style.backgroundColor = "transparent";
        }

        // Диалог для скринридера: роль и модальность прячут остальной интерфейс,
        // ловушку фокуса и возврат на триггер включает базовый контейнер по
        // опциям focusTrap/focusReturn
        modal.content.setAttribute("role", "dialog");
        modal.content.setAttribute("aria-modal", "true");

        // Доступное имя: явная подпись из настроек либо заголовок [data-title]
        if (modal.options.ariaLabel) {
            modal.content.setAttribute("aria-label", modal.options.ariaLabel);
        } else {
            const title = modal.content.querySelector<HTMLElement>("[data-title]");
            if (title) {
                if (!title.id) title.id = `${modal.options.id}-title`;
                modal.content.setAttribute("aria-labelledby", title.id);
            }
        }
    },

    /**
     * ***************************************************************************
     * Анимация контента при открытии. У модалки появление есть всегда:
     * если класс не задан, берём дефолтный `scaleUp`.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     * ***************************************************************************
     */
    openContentAnimation(modal) {
        if (!modal.content) return null;

        const preset = modal.options.openAnimationClass;

        return modal.content.animate(
            preset ? preset.animation : scaleUp.animation,
            preset ? preset.settings : scaleUp.settings
        );
    },

    /**
     * ***************************************************************************
     * Анимация оверлея при открытии.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     * ***************************************************************************
     */
    openOverlayAnimation(modal) {
        if (!modal.overlay) return null;

        // Размытие фона — только если его включил пользователь в настройках
        const isBlur = LocalStorage?.session?.settings?.user?.decorations?.blur || false;
        if (modal.options.overlayBlur && isBlur) {
            modal.overlay.classList.add("backdrop-blur-[10px]");
        }

        return modal.overlay.animate(fadeIn.animation, fadeIn.settings);
    },

    /**
     * ***************************************************************************
     * Анимации при закрытии. Свайпа у модалки нет.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * @returns {Animation[]} Массив анимаций.
     * ***************************************************************************
     */
    closeAnimations(modal) {
        if (!modal.content) return [];

        const preset = modal.options.closeAnimationClass;

        return [modal.content.animate(
            preset ? preset.animation : scaleDown.animation,
            preset ? preset.settings : scaleDown.settings
        )];
    },

    /**
     * ***************************************************************************
     * Анимация оверлея при закрытии. У модалки она есть всегда,
     * независимо от `closeAnimationClass`.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * @returns {Animation[]} Массив анимаций.
     * ***************************************************************************
     */
    closeOverlayAnimations(modal) {
        if (!modal.overlay) return [];

        return [modal.overlay.animate(fadeOut.animation, fadeOut.settings)];
    },

    /**
     * ***************************************************************************
     * Можно ли закрывать: проверяем, что оверлей ещё смонтирован.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * @returns {boolean} true, если есть что снимать с DOM.
     * ***************************************************************************
     */
    canClose(modal) {
        return !!(modal.overlay && modal.overlay.parentNode);
    }

};
