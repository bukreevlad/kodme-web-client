// Импортируем utils
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем config
import { fadeIn, fadeOut, scaleDown } from "../../../config/animations.js";
import { CDM_Z_INDEX } from "../../../config/constants.js";

// Импортируем типы
import type { OverlayPreset } from "../types.js";

/**
 * ***************************************************************************
 * Пресет типа "form" — полноэкранная форма.
 * ***************************************************************************
 *
 * Форма — это слой-экран: она закрывает всё под собой, живёт в левой/центральной
 * колонке интерфейса и на мобильных открывается «поверх» home. Отсюда её
 * особенности: отступы под безопасную зону, закрытие свайпом и переопределение
 * анимаций на мобильных.
 *
 * Что пресет НЕ меняет по сравнению с `Modal` и почему это важно:
 * - свои CSS-классы (`.cdm-form-*`) и своя переменная `--form-overlay-bg`
 *   (затемнение темнее, чем у модалок);
 * - свой z-index: формы лежат под диалогами, иначе диалог не поднимется над формой;
 * - дефолт `closeOnEsc: false` — формы-экраны живут одновременно с home,
 *   закрывать их Escape неуместно;
 * - анимации контента только при явно заданном `openAnimationClass`:
 *   дефолтного появления у экрана нет;
 * - `onBeforeOpen`, вернувший `false`, отменяет открытие.
 */
export const form: OverlayPreset = {

    /** @type {string} Имя типа. */
    name: "form",

    /** @type {string} Базовый класс, который вешается на контент. */
    rootClass: "cdm-form",

    /** @type {string} Селектор оверлея внутри обёртки. */
    overlaySelector: ".cdm-form-overlay",

    /**
     * Корневой класс уже стоит в разметке шаблона формы — навешивать его
     * второй раз незачем.
     */
    forceRootClass: false,

    /** @type {boolean} `onBeforeOpen`, вернувший false, отменяет открытие. */
    cancelOnBeforeOpen: true,

    /** @type {boolean} Ждать завершения `onOpen` перед регистрацией в навигации. */
    awaitOnOpen: true,

    /** @type {string[]} Капабилти этого типа. */
    capabilities: ["safe_area", "swipe"],

    /**
     * Дефолты настроек формы.
     * Порядок важен: `prepare` ниже переопределяет их на мобильных.
     */
    options: {
        url: null,
        insertInto: null,
        overlay: true,
        closeOnEsc: false,
        closeOnOverlay: true,
        closeOnSwipe: { direction: "right" },
        ignoreSwipeElements: [],
        onBeforeOpen: () => { },
        onOpen: () => { },
        onBeforeClose: () => { },
        onAfterClose: () => { },
        openAnimationClass: null,
        closeAnimationClass: null,
        focusTrap: false,
        focusReturn: true
    },

    /**
     * ***************************************************************************
     * Предобработка настроек. Здесь же живут мобильные переопределения.
     * @param {OverlayOptions} options - Настройки, переданные вызывающим.
     * @returns {OverlayOptions} Настройки для слияния с дефолтами.
     * ***************************************************************************
     */
    prepare(options) {

        // Работаем с копией: переопределения ниже не должны мутировать объект,
        // который передал вызывающий (он может быть общим).
        const settings = { ...options };

        // Если мобильная версия
        // Отключаем вставку форм в какое либо место
        // В мобильной версии открываются все формы друг над другом
        if (IsMobile.get() && !settings.notReplaceInsertIntoIsMobile) {
            settings.insertInto = document.querySelector<HTMLElement>(".cdm-form.home >.content >.left");
        }

        // Если мобильная версия
        // Заменяем анимации открытия и закрытия
        if (IsMobile.get() && !settings.notReplaceAnimationClassIsMobile) {
            settings.openAnimationClass = null;
            settings.closeAnimationClass = null;
        }

        return settings;
    },

    /**
     * ***************************************************************************
     * Шаблон обёртки.
     * @returns {HTMLElement} Разборный DOM-элемент обёртки.
     * ***************************************************************************
     */
    template() {

        const wrap = new DOMParser().parseFromString(`

            <div class="cdm-form-wrap flex absolute inset-0 ${CDM_Z_INDEX.FORM}">
                <div class="cdm-form-overlay absolute inset-0 ${CDM_Z_INDEX.OVERLAY_BELOW} flex bg-[var(--form-overlay-bg)]"></div>
            </div>

        `, "text/html").querySelector(".cdm-form-wrap");

        // invariant: шаблон — наши строки, обёртка в нём всегда есть
        if (!(wrap instanceof HTMLElement)) {
            throw new TypeError("form: template: обёртка .cdm-form-wrap не найдена");
        }

        return wrap;

    },

    /**
     * ***************************************************************************
     * Дополнительная подготовка обёртки перед монтированием.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * ***************************************************************************
     */
    initWrap(form) {

        // Форма-экран — диалог для скринридера, но не модальный: она открыта
        // рядом с home-лейаутом, поэтому aria-modal и ловушка фокуса не применяются
        form.content.setAttribute("role", "dialog");

        // Выпадающие меню приходят без затемнения
        if (!form.options.overlay && form.overlay) {
            form.overlay.style.backgroundColor = "transparent";
        }

        // Доступное имя: явная подпись из настроек либо заголовок [data-title]
        if (form.options.ariaLabel) {
            form.content.setAttribute("aria-label", form.options.ariaLabel);
        } else {
            const title = form.content.querySelector<HTMLElement>("[data-title]");
            if (title) {
                if (!title.id) title.id = `${form.options.id}-title`;
                form.content.setAttribute("aria-labelledby", title.id);
            }
        }

    },

    /**
     * ***************************************************************************
     * Анимация контента при открытии.
     * У формы дефолтного появления нет: анимируем только если задали явно.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     * ***************************************************************************
     */
    openContentAnimation(form) {
        if (!form.content) return null;
        if (!form.options?.openAnimationClass?.animation) return null;

        return form.content.animate(
            form.options.openAnimationClass.animation,
            form.options.openAnimationClass.settings
        );
    },

    /**
     * ***************************************************************************
     * Анимация оверлея при открытии.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * @returns {Animation|null} Анимация или null.
     * ***************************************************************************
     */
    openOverlayAnimation(form) {
        if (!form.overlay) return null;

        return form.overlay.animate(fadeIn.animation, fadeIn.settings);
    },

    /**
     * ***************************************************************************
     * Анимации при закрытии.
     * Отдельная анимация для свайпа: элемент уходит в ту же сторону, откуда
     * его тронули, а не просто исчезает.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * @param {OverlayCloseMeta} meta - Метаданные закрытия (`startX` при закрытии свайпом).
     * @returns {Animation[]} Массив анимаций.
     * ***************************************************************************
     */
    closeAnimations(form, meta) {

        const startX = meta?.startX || 0;
        const animations: Animation[] = [];

        if (!form.content) return animations;

        // Если закрываем по свайпу, подменяем кадры на динамические
        if (startX !== 0) {
            const direction = form.options.closeOnSwipe?.direction === "left" ? -1 : 1;
            const targetX = direction * window.innerWidth;

            animations.push(form.content.animate(
                [
                    { transform: `translate3d(${startX}px, 0, 0)` },
                    { transform: `translate3d(${targetX}px, 0, 0)` }
                ],
                scaleDown.settings
            ));
        } else if (form.options?.closeAnimationClass?.animation) {
            animations.push(form.content.animate(
                form.options.closeAnimationClass.animation,
                form.options.closeAnimationClass.settings
            ));
        }

        return animations;
    },

    /**
     * ***************************************************************************
     * Анимация оверлея при закрытии. У формы она есть только вместе
     * с `closeAnimationClass` — без него оверлей просто исчезает.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * @returns {Animation[]} Массив анимаций.
     * ***************************************************************************
     */
    closeOverlayAnimations(form) {
        if (!form.overlay) return [];
        if (!form.options?.closeAnimationClass?.animation) return [];

        return [form.overlay.animate(fadeOut.animation, fadeOut.settings)];
    },

    /**
     * ***************************************************************************
     * Можно ли закрывать: проверяем, что есть что удалять.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * @returns {boolean} true, если есть что снимать с DOM.
     * ***************************************************************************
     */
    canClose(form) {
        return !!(form.wrap && form.overlay && form.content);
    }

};
