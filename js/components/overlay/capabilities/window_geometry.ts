// Импортируем utils
import { MoveAndResizeController } from "../../../utils/move_and_resize_controller.js";

// Импортируем типы
import type { OverlayCapability, OverlayGeometry, OverlayGeometryData } from "../types.js";

/**
 * ***************************************************************************
 * WINDOW_GEOMETRY - позиционирование, перемещение, ресайз и геометрия окна.
 * ***************************************************************************
 *
 * Что делает:
 * - при наличии `targetNode` удерживает окно привязанным к элементу-якорю
 *   (собственный расчёт лежит в `utils/dom/anchored_positioner.js`);
 * - при `move` / `resize` разрешает таскать и тянуть окно мышью;
 * - запоминает и восстанавливает геометрию (`saveGeometry` / `restoreGeometry`),
 *   на чём построено «развернуть окно / свернуть обратно» в `forms/bot-app`.
 *
 * Почему всё вместе, а не три капабилти:
 * перетаскивание переводит окно из автоматического позиционирования в ручное
 * (`_disableAutoPositioning`), а ручная геометрия и `ResizeObserver` живут на
 * одном экземпляре. Разносить их по разным капабилти — значит получить
 * взаимную зависимость через `this`, что хуже, чем один связный блок.
 *
 * Принадлежит только типу «modal».
 */
export const windowGeometry: OverlayCapability = {

    /** @type {string} Имя капабилти. */
    name: "window_geometry",

    /**
     * ***************************************************************************
     * Состояние капабилти, которое кладётся прямо на экземпляр.
     *
     * Именно на экземпляре, а не внутрь капабилти: `geometry` снаружи читают
     * и пишут (`forms/bot-app/handlers/maximize.ts`), а `resizeObserver` нужен
     * и позиционированию, и ручной геометрии.
     * ***************************************************************************
     */
    state: {
        resizeObserver: null,
        moveAndResizeController: null,
        isManuallyPositioned: false,
        geometry: null
    },

    /**
     * ***************************************************************************
     * Методы, которые копируются на экземпляр контейнера.
     * ***************************************************************************
     */
    methods: {

        /**
         * ***************************************************************************
         * Центрированная модалка не нуждается в автоматическом позиционировании
         * по якорю: её размещает Flexbox на обёртке. Метод оставлен только
         * для совместимости с кодом, который мог его вызывать.
         * @private
         * ***************************************************************************
         */
        _setPosition() {
            if (!this.content || !this.content.isConnected) return;
            this.content.classList.add("visible");
        },

        /**
         * ***************************************************************************
         * Обновляет или инициализирует контроллер перемещения и ресайза.
         * @private
         * ***************************************************************************
         */
        _updateMoveAndResizeController() {
            if (this.moveAndResizeController) {
                if (typeof this.moveAndResizeController.destroy === "function") {
                    this.moveAndResizeController.destroy();
                }
                this.moveAndResizeController = null;
            }

            const isMoveEnabled = this.options.move === true
                || (typeof this.options.move === "object" && this.options.move?.enabled);
            const isResizeEnabled = !!this.options.resize;

            if (isMoveEnabled || isResizeEnabled) {
                const disableAutoPos = () => this._disableAutoPositioning?.();

                this.moveAndResizeController = new MoveAndResizeController({
                    content: this.content,
                    moveElement: typeof this.options.move === "object" ? this.options.move?.element : undefined,
                    draggable: isMoveEnabled,
                    resizable: isResizeEnabled,
                    onDragStart: disableAutoPos,
                    onResizeStart: disableAutoPos
                });
            }
        },

        /**
         * ***************************************************************************
         * Отключает возможность перемещения окна.
         * ***************************************************************************
         */
        disableMove() {
            // Проверяем именно на объект, а не на `typeof`: у `null` тоже
            // `typeof === "object"`, а `move` по умолчанию — это `null`.
            if (this.options.move && typeof this.options.move === "object") {
                this.options.move.enabled = false;
            } else {
                this.options.move = false;
            }
            this._updateMoveAndResizeController?.();
        },

        /**
         * ***************************************************************************
         * Включает возможность перемещения окна.
         * ***************************************************************************
         */
        enableMove() {
            if (this.options.move && typeof this.options.move === "object") {
                this.options.move.enabled = true;
            } else {
                this.options.move = true;
            }
            this._updateMoveAndResizeController?.();
        },

        /**
         * ***************************************************************************
         * Отключает возможность изменения размеров окна.
         * ***************************************************************************
         */
        disableResize() {
            this.options.resize = false;
            this._updateMoveAndResizeController?.();
        },

        /**
         * ***************************************************************************
         * Включает возможность изменения размеров окна.
         * ***************************************************************************
         */
        enableResize() {
            this.options.resize = true;
            this._updateMoveAndResizeController?.();
        },

        /**
         * ***************************************************************************
         * Сохраняет текущие координаты и размеры окна.
         * @returns {OverlayGeometry|null} Геометрия или null.
         * ***************************************************************************
         */
        saveGeometry(): OverlayGeometry | null {
            if (!this.content) return null;

            const rect = this.content.getBoundingClientRect();
            const currentLeft = parseFloat(this.content.style.left);
            const currentTop = parseFloat(this.content.style.top);

            return {
                left: !isNaN(currentLeft) ? currentLeft : rect.left,
                top: !isNaN(currentTop) ? currentTop : rect.top,
                width: this.content.offsetWidth || rect.width,
                height: this.content.offsetHeight || rect.height
            };
        },

        /**
         * ***************************************************************************
         * Восстанавливает размеры и позицию окна из переданного объекта геометрии.
         * @param {OverlayGeometryData} data - Данные геометрии.
         * @param {number} [data.width] - Ширина в пикселях.
         * @param {number} [data.height] - Высота в пикселях.
         * @param {number} [data.left] - Позиция слева в пикселях.
         * @param {number} [data.top] - Позиция сверху в пикселях.
         * ***************************************************************************
         */
        restoreGeometry(data: OverlayGeometryData) {
            if (!this.content || !data) return;

            this._disableAutoPositioning?.();

            if (data.width !== undefined) {
                this.content.style.width = `${data.width}px`;
            }
            if (data.height !== undefined) {
                this.content.style.height = `${data.height}px`;
            }
            if (data.left !== undefined) {
                this.content.style.left = `${data.left}px`;
            }
            if (data.top !== undefined) {
                this.content.style.top = `${data.top}px`;
            }
        },

        /**
         * ***************************************************************************
         * Сбрасывает ручные стили геометрии и возвращает окно
         * к автоматическому позиционированию.
         * ***************************************************************************
         */
        resetGeometry() {
            if (!this.content) return;

            this.isManuallyPositioned = false;

            this.content.style.left = "";
            this.content.style.top = "";
            this.content.style.right = "";
            this.content.style.bottom = "";
            this.content.style.width = "";
            this.content.style.height = "";
            this.content.style.transform = "";
            this.content.style.margin = "";
            this.content.style.position = "";
            this.content.style.maxHeight = "";
            this.content.style.maxWidth = "";
            this.content.style.overflow = "";

            if (window.ResizeObserver && !this.resizeObserver) {
                this.resizeObserver = new ResizeObserver(() => {
                    if (this.isManuallyPositioned && this._setPosition) {
                        this._setPosition();
                    }
                });
                if (this.content) {
                    this.resizeObserver.observe(this.content);
                }
            }

            this._setPosition?.();
        },

        /**
         * ***************************************************************************
         * Фиксирует текущие экранные координаты и размеры элемента, переводя его
         * из Flexbox в абсолютное позиционирование.
         * @private
         * ***************************************************************************
         */
        _disableAutoPositioning() {
            if (this.isManuallyPositioned) return;
            this.isManuallyPositioned = true;

            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }

            if (!this.content || !this.wrap) return;

            const rect = this.content.getBoundingClientRect();
            const wrapRect = this.wrap.getBoundingClientRect();

            const left = rect.left - wrapRect.left;
            const top = rect.top - wrapRect.top;

            this.content.style.width = `${rect.width}px`;
            this.content.style.height = `${rect.height}px`;

            this.content.style.position = "absolute";
            this.content.style.margin = "0";
            this.content.style.transform = "none";
            this.content.style.right = "auto";
            this.content.style.bottom = "auto";

            this.content.style.left = `${left}px`;
            this.content.style.top = `${top}px`;
        }

    },

    /**
     * ***************************************************************************
     * Подписывает слушатели позиционирования. Без `targetNode` `_setPosition()`
     * всё равно выходит с первой строки, а `ResizeObserver` на обычной модалке —
     * это пустая работа на каждое изменение размера окна.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * ***************************************************************************
     */
    init(modal) {
        // У центрированной модалки нет подписок на resize/scroll,
        // позиционирование делает Flexbox
    },

    /**
     * ***************************************************************************
     * Первичная расстановка окна после монтирования в DOM, но до `onOpen`:
     * к этому моменту элемент уже измерим, иначе координаты уедут.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * ***************************************************************************
     */
    onMounted(modal) {
        modal._setPosition?.();
    },

    /**
     * ***************************************************************************
     * Контроллер перемещения/ресайза создаётся после `onOpen`: вызывающий
     * в `onOpen` успевает задать размеры и отступы, которые движок уже учтёт.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * ***************************************************************************
     */
    afterOpen(modal) {
        modal._updateMoveAndResizeController?.();
    },

    /**
     * ***************************************************************************
     * Снос слушателей позиционирования и контроллера перемещения.
     * @param {OverlayLike} modal - Экземпляр контейнера.
     * ***************************************************************************
     */
    destroy(modal) {

        if (modal.resizeObserver) {
            modal.resizeObserver.disconnect();
            modal.resizeObserver = null;
        }

        if (modal.moveAndResizeController) {
            if (typeof modal.moveAndResizeController.destroy === "function") {
                modal.moveAndResizeController.destroy();
            }
            modal.moveAndResizeController = null;
        }
    }

};
