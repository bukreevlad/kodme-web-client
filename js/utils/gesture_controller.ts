/**
 * Направление свайпа (горизонталь/вертикаль).
 */
export type SwipeDirection = "left" | "right" | "up" | "down";

/** Ось движения (горизонталь или вертикаль). */
type Axis = "x" | "y";

/** Тип активного жеста. */
type GestureKind = "swipe" | "pan" | "pinch";

/**
 * Экранная точка: координаты курсора/пальца либо центр между пальцами.
 */
interface Point {

    /** Координата X, px. */
    x: number;

    /** Координата Y, px. */
    y: number;

}

/**
 * Настройки тапа (обычный клик и долгое нажатие).
 */
export interface TapOptions {

    /** Максимальная продолжительность тапа в мс (по умолчанию 200). */
    timeout?: number;

    /** Задержка для определения долгого тапа в мс (по умолчанию 500). */
    longTapTimeout?: number;

    /** Коллбэк при обычном клике/тапе. */
    onTap?: (event: Event) => void;

    /** Коллбэк при долгом нажатии. */
    onLongTap?: (event: Event) => void;

    /** Коллбэк при отпускании после долгого нажатия. */
    onLongTapEnd?: (event: Event) => void;

}

/**
 * Настройки свайпа.
 */
export interface SwipeOptions {

    /** Дистанция в px для фиксирования (commit) свайпа (по умолчанию 80). */
    commitDistance?: number;

    /** Скорость (px/ms) для фиксирования свайпа резким движением (по умолчанию 0.3). */
    commitVelocity?: number;

    /** Разрешённые направления свайпа (по умолчанию любые). */
    directions?: SwipeDirection[] | null;

    /** Коллбэк начала свайпа. */
    onStart?: (direction: SwipeDirection) => void;

    /** Коллбэк смещения при свайпе `(dx, dy, direction, progress)`. */
    onMove?: (dx: number, dy: number, direction: SwipeDirection, progress: number) => void;

    /** Коллбэк успешного выполнения свайпа. */
    onCommit?: (direction: SwipeDirection) => void;

    /** Коллбэк отмены свайпа. */
    onCancel?: (direction: SwipeDirection) => void;

    /** Коллбэк завершения свайпа `(dx, dy, velocityX, velocityY, direction, committed)`. */
    onEnd?: (
        dx: number,
        dy: number,
        velocityX: number,
        velocityY: number,
        direction: SwipeDirection,
        committed: boolean
    ) => void;

}

/**
 * Настройки панорамирования (drag/pan).
 */
export interface PanOptions {

    /** Разрешить перемещение по обеим осям одновременно. */
    freeMove?: boolean;

    /** Коллбэк начала панорамирования. */
    onStart?: (direction: SwipeDirection) => void;

    /** Коллбэк перемещения `(dx, dy, direction)`. */
    onMove?: (dx: number, dy: number, direction: SwipeDirection) => void;

    /** Коллбэк завершения панорамирования `(dx, dy, direction)`. */
    onEnd?: (dx: number, dy: number, direction: SwipeDirection) => void;

}

/**
 * Настройки жеста масштабирования (pinch zoom).
 */
export interface PinchOptions {

    /** Коллбэк начала жеста масштабирования (центр между пальцами). */
    onStart?: (point: Point) => void;

    /** Коллбэк изменения масштаба `(scale, center)`. */
    onMove?: (scale: number, point: Point) => void;

    /** Коллбэк завершения масштабирования. */
    onEnd?: () => void;

}

/**
 * Конфигурация обработчика жестов (значения по умолчанию заданы в конструкторе).
 */
export interface GestureControllerOptions {

    /** Селекторы или элементы, жесты на которых игнорируются. */
    ignore?: Array<string | HTMLElement> | undefined;

    /** Игнорировать ли фокусированные интерактивные элементы (по умолчанию true). */
    ignoreInteractive?: boolean;

    /** Блокировать ли всплытие событий к родительским элементам. */
    stopPropagation?: boolean;

    /** Минимальное смещение в px для активации жеста (по умолчанию 8). */
    threshold?: number;

    /** Настройки для событий тапа. */
    tap?: TapOptions;

    /** Настройки для событий свайпа. */
    swipe?: SwipeOptions | undefined;

    /** Настройки для событий панорамирования (drag/pan). */
    pan?: PanOptions;

    /** Настройки для событий масштабирования (pinch zoom). */
    pinch?: PinchOptions;

    /** Коллбэк вызова контекстного меню. */
    onContextMenu?: (event: MouseEvent) => void;

    /** Коллбэк при отмене жеста. */
    onCancel?: (event: Event) => void;

}

/**
 * ***************************************************************************
 * Универсальный контроллер жестов для сенсорных экранов и мыши.
 * Поддерживает Tap, Long Tap, Swipe, Pan, Pinch Zoom и блокировку фантомных кликов.
 * ***************************************************************************
 */
export class GestureController {

    // Целевой элемент и настройки

    /** Целевой DOM-элемент для отслеживания жестов. */
    el: HTMLElement;

    /** Конфигурация обработчика жестов (как передана в конструктор). */
    opts: GestureControllerOptions;

    /** Селекторы или элементы, на которых жесты игнорируются. */
    ignoreSelectors: Array<string | HTMLElement>;

    /** Игнорировать ли фокусированные интерактивные элементы. */
    ignoreInteractive: boolean;

    /** Опция блокировки всплытия событий. */
    stopPropagation: boolean;

    // Пороги срабатывания и таймеры

    /** Минимальное смещение в px для активации жеста. */
    threshold: number;

    /** Максимальная продолжительность тапа в мс. */
    tapTimeout: number;

    /** Задержка для определения долгого тапа в мс. */
    longTapTimeout: number;

    /** Таймер долгого тапа (null — таймер не запущен). */
    longTapTimer: ReturnType<typeof setTimeout> | null;

    /** Сработал ли долгий тап. */
    isLongTap: boolean;

    /** Исходное событие начала жеста (null — жест не начинался). */
    startEvent: MouseEvent | TouchEvent | null;

    // Настройки свайпа

    /** Дистанция в px для фиксирования (commit) свайпа. */
    commitDistance: number;

    /** Скорость (px/ms) для фиксирования свайпа резким движением. */
    commitVelocity: number;

    /** Разрешённые направления свайпа (null — любые направления). */
    allowedDirections: SwipeDirection[] | null;

    // Внутреннее состояние жеста

    /** Активен ли жест сейчас. */
    active: boolean;

    /** Тип текущего жеста (null — жест не определён). */
    gesture: GestureKind | null;

    /** Текущее направление движения. */
    direction: SwipeDirection | null;

    /** Зафиксированное направление жеста (не меняется после определения). */
    initialDirection: SwipeDirection | null;

    /** Заблокированная ось движения (null — обе оси свободны). */
    lockedAxis: Axis | null;

    /** Нужно ли игнорировать жест (например, запрещённое направление). */
    ignoreGesture: boolean;

    /** Основная ось движения, определённая по порогу. */
    primaryAxis: Axis | null;

    /** Зафиксирован ли свайп (onCommit уже вызван). */
    committed: boolean;

    /** Значение смещения по основной оси (для прогресса и commit-а свайпа). */
    validMove: number;

    // Флаги движения и защита от synthetic mouse events

    /** Сдвинулся ли курсор/палец дальше порога. */
    hasMoved: boolean;

    /** Время последнего тача (для блокировки фантомных кликов мыши). */
    lastTouchTime: number;

    // Состояние Pinch (масштабирование)

    /** Идёт ли жест масштабирования. */
    isPinching: boolean;

    /** Начальное расстояние между пальцами, px. */
    startPinchDist: number;

    // Координаты и временные метки

    /** Начальная координата X. */
    startX: number;

    /** Начальная координата Y. */
    startY: number;

    /** Последняя координата X. */
    lastX: number;

    /** Последняя координата Y. */
    lastY: number;

    /** Время начала жеста (performance.now()). */
    startTime: number;

    /**
     * ***************************************************************************
     * Создает экземпляр GestureController.
     * @param {HTMLElement} el - Целевой DOM-элемент для отслеживания жестов.
     * @param {GestureControllerOptions} [options={}] - Конфигурация обработчика жестов.
     * ***************************************************************************
     */
    constructor(el: HTMLElement, options: GestureControllerOptions = {}) {
        this.el = el;
        this.opts = options;

        // Настройки исключений и всплытия
        this.ignoreSelectors = options.ignore ?? [];
        this.ignoreInteractive = options.ignoreInteractive ?? true;
        this.stopPropagation = options.stopPropagation ?? false; // Опция блокировки всплытия

        // Пороги срабатывания и таймеры
        this.threshold = options.threshold ?? 8;
        this.tapTimeout = options.tap?.timeout ?? 200;
        this.longTapTimeout = options.tap?.longTapTimeout ?? 500;

        // Состояние таймера долгого тапа
        this.longTapTimer = null;
        this.isLongTap = false;
        this.startEvent = null;

        // Настройки свайпа
        this.commitDistance = options.swipe?.commitDistance ?? 80;
        this.commitVelocity = options.swipe?.commitVelocity ?? 0.3;
        this.allowedDirections = options.swipe?.directions ?? null;

        // Внутреннее состояние жеста
        this.active = false;
        this.gesture = null;
        this.direction = null;
        this.initialDirection = null;
        this.lockedAxis = null;
        this.ignoreGesture = false;
        this.primaryAxis = null;
        this.committed = false;
        this.validMove = 0;

        // Флаги движения и защиты от synthetic mouse events
        this.hasMoved = false;
        this.lastTouchTime = 0; // Время последнего тача (для блокировки фантомных кликов мыши)

        // Состояние Pinch (масштабирование)
        this.isPinching = false;
        this.startPinchDist = 0;

        // Координаты и временные метки
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.startTime = 0;

        this.bind();
    }

    /**
     * ***************************************************************************
     * Подписывает элемент и документ на события мыши, тача и контекстного меню.
     * @returns {void}
     * ***************************************************************************
     */
    bind(): void {
        this.el?.addEventListener("mousedown", this.onMouseDown);
        document?.addEventListener("mousemove", this.onMouseMove);
        document?.addEventListener("mouseup", this.onMouseUp);
        this.el?.addEventListener("touchstart", this.onTouchStart, { passive: false });
        document?.addEventListener("touchmove", this.onTouchMove, { passive: false });
        document?.addEventListener("touchend", this.onTouchEnd);
        document?.addEventListener("touchcancel", this.onTouchCancel);
        this.el?.addEventListener("contextmenu", this.onContextMenu);
    }

    /**
     * ***************************************************************************
     * Удаляет все слушатели событий и очищает активные таймеры.
     * Должен вызываться при уничтожении компонента.
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {
        this.clearLongTapTimer();
        this.el?.removeEventListener("mousedown", this.onMouseDown);
        document?.removeEventListener("mousemove", this.onMouseMove);
        document?.removeEventListener("mouseup", this.onMouseUp);
        this.el?.removeEventListener("touchstart", this.onTouchStart);
        document?.removeEventListener("touchmove", this.onTouchMove);
        document?.removeEventListener("touchend", this.onTouchEnd);
        document?.removeEventListener("touchcancel", this.onTouchCancel);
        this.el?.removeEventListener("contextmenu", this.onContextMenu);
    }

    /**
     * ***************************************************************************
     * Извлекает экранные координаты X и Y из события мыши или тача.
     * @param {MouseEvent|TouchEvent} e - Событие ввода.
     * @returns {{x: number, y: number}|null} Объект с координатами или null, если координаты не определены.
     * ***************************************************************************
     */
    getEventPos(e: MouseEvent | TouchEvent): Point | null {
        if ("touches" in e) {
            // Событие тача: координаты берём из активных касаний (если они есть)
            const touch = e.touches[0];
            if (touch) return { x: touch.clientX, y: touch.clientY };
            return null;
        }
        return { x: e.clientX, y: e.clientY };
    }

    /**
     * ***************************************************************************
     * Вычисляет центральную точку между двумя точками касания (для Pinch).
     * @private
     * @param {TouchList} touches - Список точек касания.
     * @returns {{x: number, y: number}|null} Координаты центральной точки.
     * ***************************************************************************
     */
    _getMidpoint(touches: TouchList): Point | null {
        const first = touches[0];
        const second = touches[1];
        if (!first || !second) return null;
        return {
            x: (first.clientX + second.clientX) / 2,
            y: (first.clientY + second.clientY) / 2
        };
    }

    /**
     * ***************************************************************************
     * Вычисляет Евклидово расстояние между двумя точками касания (для Pinch).
     * @private
     * @param {TouchList} touches - Список точек касания.
     * @returns {number} Расстояние в пикселях.
     * ***************************************************************************
     */
    _getDistance(touches: TouchList): number {
        const first = touches[0];
        const second = touches[1];
        if (!first || !second) return 0;
        return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    }

    /**
     * ***************************************************************************
     * Инициализирует состояние при начале ввода (mousedown / touchstart)
     * и запускает таймер отслеживания долгого нажатия.
     * @param {number} x - Начальная координата X.
     * @param {number} y - Начальная координата Y.
     * @param {MouseEvent|TouchEvent} event - Исходное событие DOM.
     * @returns {void}
     * ***************************************************************************
     */
    startGesture(x: number, y: number, event: MouseEvent | TouchEvent): void {
        this.active = true;
        this.hasMoved = false;
        this.gesture = null;
        this.ignoreGesture = false;
        this.isPinching = false;
        this.primaryAxis = null;
        this.committed = false;
        this.direction = null;
        this.initialDirection = null;
        this.lockedAxis = null;
        this.validMove = 0;

        this.startX = this.lastX = x;
        this.startY = this.lastY = y;
        this.startTime = performance.now();

        this.startEvent = event;
        this.isLongTap = false;

        this.clearLongTapTimer();
        // invariant: стартовое событие назначено выше по входу в метод;
        // локальные захваты нужны, чтобы таймер не читал поля позже
        const onLongTap = this.opts.tap?.onLongTap;
        const startEvent = this.startEvent;
        if (onLongTap && startEvent) {
            this.longTapTimer = setTimeout(() => {
                if (this.active && !this.gesture && !this.ignoreGesture && !this.hasMoved) {
                    this.isLongTap = true;
                    onLongTap(startEvent);
                }
            }, this.longTapTimeout);
        }
    }

    /**
     * ***************************************************************************
     * Завершает жест при отпускании (mouseup / touchend), проверяет пороги скорости/дистанции
     * и вызывает соответствующие коллбэки (tap, swipe end/commit/cancel, pan end, pinch end).
     * @param {number} x - Конечная координата X.
     * @param {number} y - Конечная координата Y.
     * @param {MouseEvent|TouchEvent} event - Исходное событие DOM.
     * @returns {void}
     * ***************************************************************************
     */
    endGesture(x: number, y: number, event: MouseEvent | TouchEvent): void {
        this.clearLongTapTimer();
        if (!this.active) return;

        // Сохраняем факт долгого нажатия, чтобы вызвать его завершение
        // даже если во время удержания жест стал свайпом или был проигнорирован.
        const wasLongTap = this.isLongTap;

        if (this.isPinching) {
            this.opts.pinch?.onEnd?.();
        } else if (this.gesture === "swipe" && this.initialDirection) {
            const dx = x - this.startX;
            const dy = y - this.startY;
            const dt = performance.now() - this.startTime;
            const velocityX = dx / dt;
            const velocityY = dy / dt;

            // invariant: направление присваивается в checkGesture вместе
            // с классификацией жеста — сужено условием ветки выше
            const dir = this.initialDirection;
            const velocity = (dir === "left" || dir === "right") ? velocityX : velocityY;

            const isCorrectVelocityDirection =
                (dir === "left" || dir === "up") ? velocity <= -this.commitVelocity :
                    (dir === "right" || dir === "down") ? velocity >= this.commitVelocity : false;

            const committed = Math.abs(this.validMove) >= this.commitDistance || isCorrectVelocityDirection;
            const allowed = !this.allowedDirections || this.allowedDirections.includes(dir);

            if (!this.committed && committed && allowed) {
                this.committed = true;
                this.opts.swipe?.onCommit?.(dir);
            } else if (!committed || !allowed) {
                this.opts.swipe?.onCancel?.(dir);
            }

            this.opts.swipe?.onEnd?.(dx, dy, velocityX, velocityY, dir, committed && allowed);
        } else if (this.gesture === "pan" && this.direction) {
            const dx = x - this.startX;
            const dy = y - this.startY;
            // invariant: направление присваивается в checkGesture вместе
            // с классификацией жеста — сужено условием ветки выше
            this.opts.pan?.onEnd?.(dx, dy, this.direction);
        } else if (!this.ignoreGesture && !this.isLongTap && !this.hasMoved) {
            const now = performance.now();
            const duration = now - this.startTime;
            const dist = Math.hypot(x - this.startX, y - this.startY);

            if (duration < this.tapTimeout && dist < this.threshold) {
                this.opts.tap?.onTap?.(event);
            }
        }

        // Завершение долгого нажатия вызывается после всех обработчиков жеста,
        // чтобы потребитель мог корректно завершить удержание или отмену.
        if (wasLongTap) {
            this.opts.tap?.onLongTapEnd?.(event);
        }

        this.active = false;
        this.gesture = null;
        this.direction = null;
        this.initialDirection = null;
        this.lockedAxis = null;
        this.ignoreGesture = false;
        this.primaryAxis = null;
        this.committed = false;
        this.isPinching = false;
        this.hasMoved = false;
        this.isLongTap = false;
        this.validMove = 0;
    }

    /**
     * ***************************************************************************
     * Опредяляет тип жеста (swipe или pan) и блокирует движение по нецелевой оси
     * при превышении порога `threshold`.
     * @param {number} x - Текущая координата X.
     * @param {number} y - Текущая координата Y.
     * @returns {void}
     * ***************************************************************************
     */
    checkGesture(x: number, y: number): void {
        if (this.gesture || this.ignoreGesture || this.isPinching) return;

        const dx = x - this.startX;
        const dy = y - this.startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < this.threshold && absY < this.threshold) return;

        if (!this.primaryAxis) this.primaryAxis = absX > absY ? "x" : "y";

        if (this.opts.swipe && absX > absY) {
            const dir = dx > 0 ? "right" : "left";
            if (this.allowedDirections && !this.allowedDirections.includes(dir)) {
                this.ignoreGesture = true;
                return;
            }
            this.gesture = "swipe"; this.lockedAxis = "x"; this.direction = dir; this.initialDirection = dir;
            this.opts.swipe?.onStart?.(dir); return;
        }

        if (this.opts.swipe && absY > absX) {
            const dir = dy > 0 ? "down" : "up";
            if (this.allowedDirections && !this.allowedDirections.includes(dir)) {
                this.ignoreGesture = true;
                return;
            }
            this.gesture = "swipe"; this.lockedAxis = "y"; this.direction = dir; this.initialDirection = dir;
            this.opts.swipe?.onStart?.(dir); return;
        }

        if (this.opts.pan) {
            const primaryAxis = absX > absY ? "x" : "y";
            const dir = primaryAxis === "x" ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
            this.gesture = "pan";
            this.lockedAxis = this.opts.pan.freeMove ? null : primaryAxis;
            this.direction = dir;
            this.opts.pan?.onStart?.(dir);
        }
    }

    /**
     * ***************************************************************************
     * Основная логика обработки перемещения (mousemove / touchmove).
     * Отслеживает движение, Pinch-зум и передает изменения в коллбэки `onMove`.
     * @param {MouseEvent|TouchEvent} e - Событие перемещения DOM.
     * @param {{x: number, y: number}} pos - Текущие позиции курсора или пальца.
     * @returns {void}
     * ***************************************************************************
     */
    handleMove(e: MouseEvent | TouchEvent, pos: Point): void {
        if (!this.active) return;

        this.lastX = pos.x;
        this.lastY = pos.y;

        const dist = Math.hypot(pos.x - this.startX, pos.y - this.startY);
        if (dist >= this.threshold) {
            this.hasMoved = true;
            this.clearLongTapTimer();
        }

        if ("touches" in e && e.touches.length === 2 && this.opts.pinch) {
            const currentDist = this._getDistance(e.touches);
            const midpoint = this._getMidpoint(e.touches);

            if (!this.isPinching) {
                this.isPinching = true;
                this.gesture = "pinch";
                this.startPinchDist = currentDist;
                // invariant: в ветке всегда два касания — midpoint не null
                if (midpoint) this.opts.pinch.onStart?.(midpoint);
                return;
            }

            const scale = currentDist / this.startPinchDist;
            // invariant: в ветке всегда два касания — midpoint не null
            if (midpoint) this.opts.pinch.onMove?.(scale, midpoint);

            if (e.cancelable) e.preventDefault();
            return;
        }

        if (this.isPinching) return;

        this.checkGesture(pos.x, pos.y);
        if (!this.gesture) return;

        if (e.cancelable) e.preventDefault();

        let dx = pos.x - this.startX;
        let dy = pos.y - this.startY;

        if (this.lockedAxis === "x") dy = 0;
        if (this.lockedAxis === "y") dx = 0;

        if (this.gesture === "swipe" && this.initialDirection) {
            if (this.initialDirection === "left" && dx > 0) dx = 0;
            if (this.initialDirection === "right" && dx < 0) dx = 0;
            if (this.initialDirection === "up" && dy > 0) dy = 0;
            if (this.initialDirection === "down" && dy < 0) dy = 0;
            this.validMove = this.lockedAxis === "x" ? dx : dy;
        }

        const progress = this.gesture === "swipe"
            ? Math.min(Math.abs(this.validMove) / this.commitDistance, 1)
            : 0;

        // NOTE(MIGRATION): легаси вызывал this.opts[this.gesture]?.onMove?.(dx, dy, direction, progress).
        // До этой строки жест всегда "swipe" либо "pan" (pinch возвращается выше по isPinching),
        // а 4-й аргумент progress для pan.onMove в JavaScript игнорируется — вызовы разделены
        // по типу жеста без изменения поведения.
        if (this.gesture === "swipe" && this.direction) {
            this.opts.swipe?.onMove?.(dx, dy, this.direction, progress);
        } else if (this.gesture === "pan" && this.direction) {
            this.opts.pan?.onMove?.(dx, dy, this.direction);
        }

        if (this.gesture === "swipe" && !this.committed && this.initialDirection) {
            if (Math.abs(this.validMove) >= this.commitDistance) {
                this.committed = true;
                this.opts.swipe?.onCommit?.(this.initialDirection);
            }
        }
    }

    /* ===================== EVENT HANDLERS ===================== */

    /**
     * ***************************************************************************
     * Обработчик события mousedown.
     * Игнорирует фиктивные клики мыши после касаний на мобильных устройствах.
     * @param {MouseEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onMouseDown = (e: MouseEvent) => {
        // Игнорируем искусственные мышиные события после тача (в течение 800мс)
        if (performance.now() - this.lastTouchTime < 800) return;

        if (this.stopPropagation) {
            e.stopPropagation();
        }

        if (e.button !== 0 || this.isInteractiveElement(e.target)) return;
        this.startGesture(e.clientX, e.clientY, e);
    }

    /**
     * ***************************************************************************
     * Обработчик события mousemove.
     * @param {MouseEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onMouseMove = (e: MouseEvent) => {
        const pos = this.getEventPos(e);
        if (pos) this.handleMove(e, pos);
    }

    /**
     * ***************************************************************************
     * Обработчик события mouseup.
     * @param {MouseEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onMouseUp = (e: MouseEvent) => {
        if (!this.active) return;
        this.endGesture(e.clientX, e.clientY, e);
    }

    /**
     * ***************************************************************************
     * Обработчик события touchstart.
     * Фиксирует время последнего касания для блокировки фантомных кликов мыши.
     * @param {TouchEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onTouchStart = (e: TouchEvent) => {
        this.lastTouchTime = performance.now();

        // Останавливаем всплытие к родителям (например, к контейнеру сообщения), если включено
        if (this.stopPropagation) {
            e.stopPropagation();
        }

        if (this.isInteractiveElement(e.target)) return;
        const pos = this.getEventPos(e);
        if (pos) {
            this.startGesture(pos.x, pos.y, e);
            if (e.touches.length === 2 && this.opts.pinch) {
                this.isPinching = true;
                this.gesture = "pinch";
                this.startPinchDist = this._getDistance(e.touches);
                // invariant: в ветке всегда два касания — midpoint не null
                const midpoint = this._getMidpoint(e.touches);
                if (midpoint) this.opts.pinch.onStart?.(midpoint);
            }
        }
    }

    /**
     * ***************************************************************************
     * Обработчик события touchmove.
     * @param {TouchEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onTouchMove = (e: TouchEvent) => {
        const pos = this.getEventPos(e);
        if (pos) this.handleMove(e, pos);
    }

    /**
     * ***************************************************************************
     * Обработчик события touchend.
     * @param {TouchEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onTouchEnd = (e: TouchEvent) => {
        if (!this.active) return;
        this.lastTouchTime = performance.now();

        const touch = e.changedTouches?.[0] || e.touches?.[0];
        const pos = touch ? { x: touch.clientX, y: touch.clientY } : { x: this.lastX, y: this.lastY };
        this.endGesture(pos.x, pos.y, e);
    }

    /**
     * ***************************************************************************
     * Обработчик события touchcancel. Очищает состояние жеста.
     * @param {TouchEvent} e - Событие отмены касания.
     * @returns {void}
     * ***************************************************************************
     */
    onTouchCancel = (e: TouchEvent) => {
        const wasActive = this.active;

        this.clearLongTapTimer();

        // Сообщаем потребителю об отмене, чтобы он мог остановить
        // асинхронное действие, начатое во время удержания.
        if (wasActive) this.opts.onCancel?.(e);

        this.active = false;
        this.gesture = null;
        this.hasMoved = false;
        this.isLongTap = false;
        this.ignoreGesture = false;
        this.isPinching = false;
    }

    /**
     * ***************************************************************************
     * Обработчик события contextmenu (правый клик или долгое нажатие).
     * @param {MouseEvent} e
     * @returns {void}
     * ***************************************************************************
     */
    onContextMenu = (e: MouseEvent) => {
        if (this.stopPropagation) {
            e.stopPropagation();
        }
        this.opts.onContextMenu?.(e);
    }

    /**
     * ***************************************************************************
     * Очищает активный таймер долгого тапа.
     * @returns {void}
     * ***************************************************************************
     */
    clearLongTapTimer(): void {
        if (this.longTapTimer) {
            clearTimeout(this.longTapTimer);
            this.longTapTimer = null;
        }
    }

    /**
     * ***************************************************************************
     * Проверяет, является ли целевой элемент интерактивным (инпуты, кнопки, фокусные элементы)
     * или входит ли он в список `ignoreSelectors`, чтобы не перехватывать жесты.
     * @param {EventTarget|null} target - Элемент-мишень события.
     * @returns {boolean} True, если элемент интерактивный или игнорируемый.
     * ***************************************************************************
     */
    isInteractiveElement(target: EventTarget | null): boolean {
        // NOTE(MIGRATION): цели событий здесь — всегда Element; для «не-элементов»
        // (document/window) у легаси на .matches() был бы TypeError, поэтому
        // поведение нормализовано к «элемент не интерактивный» (недостижимый случай).
        if (!(target instanceof Element)) return false;

        if (this.ignoreSelectors.length > 0) {
            let element: Element | null = target;
            while (element && element !== this.el && element !== document.body) {
                // Захват для замыкания: сужение `element` из условия цикла
                // внутрь колбэка `.some()` не переносится
                const current = element;
                const isIgnored = this.ignoreSelectors.some(item => {
                    if (typeof item === 'string') {
                        return current.matches(item);
                    } else if (item instanceof HTMLElement) {
                        return current === item;
                    }
                    return false;
                });

                if (isIgnored) return true;
                element = element.parentElement;
            }
        }

        if (!this.ignoreInteractive) return false;

        const interactiveSelectors = [
            `input[type="range"]:not([disabled])`,
            'input:not([readonly]):not([disabled]):focus',
            'textarea:not([readonly]):not([disabled]):focus',
            'select:not([disabled]):focus',
            'button:not([disabled]):focus',
            '[contenteditable="true"]'
        ];

        let element: Element | null = target;
        while (element && element !== document.body) {
            // Захват для замыкания: сужение `element` из условия цикла
            // внутрь колбэка `.some()` не переносится
            // Явная аннотация разрывает цикл вывода типов (`current` ↔ `element`)
            const current: Element = element;
            if (interactiveSelectors.some(selector => current.matches(selector))) return true;
            if (current.getAttribute('role') === 'textbox' ||
                current.getAttribute('contenteditable') === 'true') return true;
            element = current.parentElement;
        }
        return false;
    }

}
