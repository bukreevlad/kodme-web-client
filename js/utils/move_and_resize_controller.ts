import { GestureController } from "./gesture_controller.js";

/**
 * Прямоугольник, который ведёт контроллер (стартовое состояние границ).
 */
interface MoveAndResizeRect {

    /** Отступ слева, px. */
    left: number;

    /** Отступ сверху, px. */
    top: number;

    /** Ширина, px. */
    width: number;

    /** Высота, px. */
    height: number;

}

/**
 * Опции создания контроллера (значения по умолчанию заданы в конструкторе).
 */
export interface MoveAndResizeControllerOptions {

    /** Элемент, который двигаем/резаем (форма). Обязателен: без элемента
     * контроллеру нечего двигать. */
    content: HTMLElement;

    /** Элемент, за который тянут (по умолчанию — `content`). */
    moveElement?: HTMLElement | null | undefined;

    /** Разрешить перетаскивание. */
    draggable?: boolean | undefined;

    /** Разрешить изменение размера. */
    resizable?: boolean;

    /** Минимальная ширина, px. */
    minWidth?: number;

    /** Минимальная высота, px. */
    minHeight?: number;

    /** Коллбэк начала перетаскивания. */
    onDragStart?: (() => void) | null;

    /** Коллбэк смещения при перетаскивании `(left, top)`. */
    onDrag?: ((left: number, top: number) => void) | null;

    /** Коллбэк начала изменения размера. */
    onResizeStart?: (() => void) | null;

    /** Коллбэк изменения размера `(width, height)`. */
    onResize?: ((width: number, height: number) => void) | null;

}

/**
 * Опции после применения значений по умолчанию (то, что хранит `this.opts`).
 */
type ResolvedMoveAndResizeOptions = {

    /** Элемент, который двигаем/резаем (форма). */
    content: HTMLElement;

    /** Элемент, за который тянут (по умолчанию — `content`). */
    moveElement: HTMLElement;

    /** Разрешить перетаскивание. */
    draggable: boolean | undefined;

    /** Разрешить изменение размера. */
    resizable: boolean;

    /** Минимальная ширина, px. */
    minWidth: number;

    /** Минимальная высота, px. */
    minHeight: number;

    /** Коллбэк начала перетаскивания. */
    onDragStart: (() => void) | null | undefined;

    /** Коллбэк смещения при перетаскивании `(left, top)`. */
    onDrag: ((left: number, top: number) => void) | null;

    /** Коллбэк начала изменения размера. */
    onResizeStart: (() => void) | null | undefined;

    /** Коллбэк изменения размера `(width, height)`. */
    onResize: ((width: number, height: number) => void) | null;

};

/**
 * ***************************************************************************
 * MoveAndResizeController - перетаскивание и изменение размера окна.
 *
 * Работает поверх GestureController (тач + мышь) и вешает временный
 * полноэкранный оверлей на время движения, чтобы ни один элемент интерфейса
 * не перехватывал события. Вызывается из capabilities оверлея
 * (`components/overlay/capabilities/window_geometry.js`).
 * ***************************************************************************
 */
export class MoveAndResizeController {

    /** Раскрытые опции со значениями по умолчанию. */
    opts: ResolvedMoveAndResizeOptions;

    /** Двигаемый элемент (`opts.content`). */
    form: HTMLElement;

    /** Элемент, за который тянут (`opts.moveElement` либо `form`). */
    moveElement: HTMLElement;

    /** Активные контроллеры жестов (перетаскивание + ручки ресайза). */
    controllers: GestureController[];

    /** Созданные ручки изменения размера. */
    resizeHandles: HTMLElement[];

    /** Стартовые границы на момент начала движения. */
    startRect: MoveAndResizeRect;

    /** Временный полноэкранный оверлей, перехватывающий события. */
    _activeOverlay: HTMLElement | null;

    /**
     * ***************************************************************************
     * Создание контроллера.
     * @param options - Опции (см. MoveAndResizeControllerOptions).
     * ***************************************************************************
     */
    constructor(options: MoveAndResizeControllerOptions) {
        this.opts = {
            draggable: true,
            resizable: false,
            minWidth: 200,
            minHeight: 150,
            onDragStart: null,
            onDrag: null,
            onResizeStart: null,
            onResize: null,
            ...options,
            // `content` обязателен, а `moveElement` резолвится на элемент по
            // умолчанию — после спреда, чтобы явный undefined из вызова
            // не затёр фолбэк
            content: options.content,
            moveElement: options.moveElement || options.content
        };

        this.form = this.opts.content;
        this.moveElement = this.opts.moveElement;

        this.controllers = [];
        this.resizeHandles = [];
        this.startRect = { left: 0, top: 0, width: 0, height: 0 };
        this._activeOverlay = null;

        if (this.opts.draggable) this._initDrag();
        if (this.opts.resizable) this._initResize();
    }

    // Создаем временный полноэкранный оверлей, чтобы перехватить все движения мыши/пальца
    _createOverlay(cursor: string): void {
        if (this._activeOverlay) return;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 999999;
            cursor: ${cursor};
            background: transparent;
            user-select: none;
        `;
        document.body.appendChild(overlay);
        this._activeOverlay = overlay;
    }

    // Удаляем оверлей при завершении движения
    _removeOverlay(): void {
        if (this._activeOverlay) {
            this._activeOverlay.remove();
            this._activeOverlay = null;
        }
    }

    _initDrag(): void {
        const dragController = new GestureController(this.moveElement, {
            threshold: 2,
            pan: {
                freeMove: true,
                onStart: () => {
                    this._createOverlay('move');
                    this.opts.onDragStart?.();

                    const currentLeft = parseFloat(this.form.style.left);
                    const currentTop = parseFloat(this.form.style.top);

                    this.startRect.left = !isNaN(currentLeft) ? currentLeft : this.form.offsetLeft;
                    this.startRect.top = !isNaN(currentTop) ? currentTop : this.form.offsetTop;

                    this.form.style.position = 'absolute';
                    this.form.style.right = 'auto';
                    this.form.style.bottom = 'auto';
                    this.form.style.margin = '0';

                    const handleRelease = () => {
                        this._removeOverlay();
                        window.removeEventListener('mouseup', handleRelease);
                        window.removeEventListener('touchend', handleRelease);
                    };
                    window.addEventListener('mouseup', handleRelease);
                    window.addEventListener('touchend', handleRelease);
                },
                onMove: (dx: number, dy: number) => {
                    const newLeft = this.startRect.left + dx;
                    const newTop = this.startRect.top + dy;

                    this.form.style.left = `${newLeft}px`;
                    this.form.style.top = `${newTop}px`;

                    this.opts.onDrag?.(newLeft, newTop);
                }
            }
        });

        this.controllers.push(dragController);
    }

    _initResize(): void {
        const handleConfigs = [
            { name: 'n', cursor: 'ns-resize', style: 'top: 0; left: 8px; right: 8px; height: 5px;' },
            { name: 's', cursor: 'ns-resize', style: 'bottom: 0; left: 8px; right: 8px; height: 5px;' },
            { name: 'w', cursor: 'ew-resize', style: 'top: 8px; bottom: 8px; left: 0; width: 5px;' },
            { name: 'e', cursor: 'ew-resize', style: 'top: 8px; bottom: 8px; right: 0; width: 5px;' },
            { name: 'nw', cursor: 'nwse-resize', style: 'top: 0; left: 0; width: 10px; height: 10px; z-index: 2;' },
            { name: 'ne', cursor: 'nesw-resize', style: 'top: 0; right: 0; width: 10px; height: 10px; z-index: 2;' },
            { name: 'sw', cursor: 'nesw-resize', style: 'bottom: 0; left: 0; width: 10px; height: 10px; z-index: 2;' },
            { name: 'se', cursor: 'nwse-resize', style: 'bottom: 0; right: 0; width: 10px; height: 10px; z-index: 2;' }
        ];

        handleConfigs.forEach(config => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${config.name}`;
            handle.style.cssText = `position: absolute; ${config.style}; cursor: ${config.cursor}; background: transparent; user-select: none;`;

            this.form.appendChild(handle);
            this.resizeHandles.push(handle);

            const resizeController = new GestureController(handle, {
                threshold: 2,
                pan: {
                    freeMove: true,
                    onStart: () => {
                        this._createOverlay(config.cursor);
                        this.opts.onResizeStart?.();

                        this.startRect.width = this.form.offsetWidth;
                        this.startRect.height = this.form.offsetHeight;

                        const currentLeft = parseFloat(this.form.style.left);
                        const currentTop = parseFloat(this.form.style.top);
                        this.startRect.left = !isNaN(currentLeft) ? currentLeft : this.form.offsetLeft;
                        this.startRect.top = !isNaN(currentTop) ? currentTop : this.form.offsetTop;

                        this.form.style.position = 'absolute';
                        this.form.style.left = `${this.startRect.left}px`;
                        this.form.style.top = `${this.startRect.top}px`;
                        this.form.style.right = 'auto';
                        this.form.style.bottom = 'auto';
                        this.form.style.margin = '0';
                        this.form.style.maxWidth = 'none';
                        this.form.style.maxHeight = 'none';

                        const handleRelease = () => {
                            this._removeOverlay();
                            window.removeEventListener('mouseup', handleRelease);
                            window.removeEventListener('touchend', handleRelease);
                        };
                        window.addEventListener('mouseup', handleRelease);
                        window.addEventListener('touchend', handleRelease);
                    },
                    onMove: (dx: number, dy: number) => {
                        let newWidth = this.startRect.width;
                        let newHeight = this.startRect.height;
                        let newLeft = this.startRect.left;
                        let newTop = this.startRect.top;

                        const isLeft = config.name.includes('w');
                        const isRight = config.name.includes('e');
                        const isTop = config.name.includes('n');
                        const isBottom = config.name.includes('s');

                        if (isRight) {
                            newWidth = Math.max(this.opts.minWidth, this.startRect.width + dx);
                        } else if (isLeft) {
                            const potentialWidth = this.startRect.width - dx;
                            if (potentialWidth >= this.opts.minWidth) {
                                newWidth = potentialWidth;
                                newLeft = this.startRect.left + dx;
                            } else {
                                newWidth = this.opts.minWidth;
                                newLeft = this.startRect.left + (this.startRect.width - this.opts.minWidth);
                            }
                        }

                        if (isBottom) {
                            newHeight = Math.max(this.opts.minHeight, this.startRect.height + dy);
                        } else if (isTop) {
                            const potentialHeight = this.startRect.height - dy;
                            if (potentialHeight >= this.opts.minHeight) {
                                newHeight = potentialHeight;
                                newTop = this.startRect.top + dy;
                            } else {
                                newHeight = this.opts.minHeight;
                                newTop = this.startRect.top + (this.startRect.height - this.opts.minHeight);
                            }
                        }

                        this.form.style.width = `${newWidth}px`;
                        this.form.style.height = `${newHeight}px`;
                        this.form.style.left = `${newLeft}px`;
                        this.form.style.top = `${newTop}px`;

                        this.opts.onResize?.(newWidth, newHeight);
                    }
                }
            });

            this.controllers.push(resizeController);
        });
    }

    destroy(): void {
        this._removeOverlay();
        this.resizeHandles.forEach(handle => handle.remove());
        this.resizeHandles = [];

        this.controllers.forEach(c => c.destroy());
        this.controllers = [];
    }
}