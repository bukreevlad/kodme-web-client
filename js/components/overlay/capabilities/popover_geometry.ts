// Импортируем utils
import { AnchoredPositioner } from "../../../utils/dom/anchored_positioner.js";

// Импортируем типы
import type { OverlayCapability } from "../types.js";

/**
 * Отступ от краёв обёртки при позиционировании.
 * Раньше эта величина была константой внутри `components/context_menu.js`,
 * оттуда и взято значение.
 */
const PADDING = 10;

/**
 * ***************************************************************************
 * POPOVER_GEOMETRY - удержание поповера у якоря.
 *
 * Что делает:
 * - считает позицию окна относительно `targetNode` либо относительно точки
 *   `x` / `y` (контекстные меню по правому клику, якоря-элемента у них нет);
 * - пересчитывает её при изменении размеров окна и при прокрутке/ресайзе
 *   браузера, а также по `ResizeObserver`, если окно меняет размер само
 *   (длинное меню, ужатое по высоте);
 * - ставит окну класс `visible`, когда позиция рассчитана.
 *
 * Почему это капабилти, а не часть пресета:
 * сам расчёт лежит в `utils/dom/anchored_positioner.js` и общий для всех
 * привязанных слоёв. Капабилти решает только «когда и по чему считать»:
 * якорь берётся у поповера, а не у диалога.
 *
 * Почему границы — обёртка, а не вьюпорт:
 * поповер вставлен не в `body`, а внутрь той области, к которой привязан
 * (поле ввода в форме чата). Ограничивать его экраном значило бы разрешить
 * ему вылезти за пределы формы, в которой он живёт. У контекстных меню
 * обёртка раскрыта на весь экран, поэтому там границы совпадают с вьюпортом.
 *
 * Принадлежит только типу «popover».
 */
export const popoverGeometry: OverlayCapability = {

    /** @type {string} Имя капабилти. */
    name: "popover_geometry",

    /**
     * ***************************************************************************
     * Состояние капабилти, которое кладётся прямо на экземпляр.
     *
     * На экземпляре, а не внутри капабилти: `resizeObserver` нужен и
     * позиционированию, и ручной геометрии других типов, и прятать его
     * в замыкание означало бы дублировать его в двух капабилти.
     * ***************************************************************************
     */
    state: {
        resizeObserver: null
    },

    /**
     * ***************************************************************************
     * Методы, которые копируются на экземпляр контейнера.
     * ***************************************************************************
     */
    methods: {

        /**
         * ***************************************************************************
         * Рассчитывает и устанавливает координаты окна относительно якоря
         * (или точки) и границ обёртки.
         * @private
         * ***************************************************************************
         */
        _setPosition() {

            if (!this.content || !this.content.isConnected) return;

            // Якорь важнее точки: элемент мог остаться с прошлого открытия,
            // а координаты курсора к этому моменту уже неактуальны
            const anchor = this.options.targetNode instanceof HTMLElement
                ? this.options.targetNode
                : null;

            const isPositioned = AnchoredPositioner.set({
                content: this.content,
                // null — явное «якоря нет»: точка в этом случае важнее
                anchor,
                point: anchor ? null : { x: this.options.x, y: this.options.y },
                bounds: this.wrap,
                direction: this.options.targetNodeDirection,
                margin: this.options.margin,
                padding: PADDING,
                fit: this.options.fit,
                relativeTo: this.wrap
            });

            if (isPositioned) {
                this.content.classList.add("visible");
            }

        }

    },

    /**
     * ***************************************************************************
     * Подписывает слушатели пересчёта позиции.
     *
     * Без подписки поповер остался бы на месте при прокрутке чата: якорь
     * уехал вверх, а окно — нет.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * ***************************************************************************
     */
    init(popover) {

        // Привязка ресайза/скролла есть не у каждого слоя (null — подписок нет)
        const boundResize = popover.boundResize;
        if (boundResize) {
            window?.addEventListener("resize", boundResize);
            window?.addEventListener("scroll", boundResize, { passive: true });
        }

        if (window.ResizeObserver && popover.content) {
            popover.resizeObserver = new ResizeObserver(() => popover._setPosition?.());
            popover.resizeObserver.observe(popover.content);
        }

    },

    /**
     * ***************************************************************************
     * Первичная расстановка окна после монтирования в DOM, но до `onOpen`:
     * к этому моменту элемент уже измерим, иначе координаты уедут.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * ***************************************************************************
     */
    onMounted(popover) {
        popover._setPosition?.();
    },

    /**
     * ***************************************************************************
     * Снос слушателей пересчёта позиции.
     * @param {OverlayLike} popover - Экземпляр контейнера.
     * ***************************************************************************
     */
    destroy(popover) {

        const boundResize = popover.boundResize;
        if (boundResize) {
            window.removeEventListener("resize", boundResize);
            window.removeEventListener("scroll", boundResize);
        }

        if (popover.resizeObserver) {
            popover.resizeObserver.disconnect();
            popover.resizeObserver = null;
        }

    }

};