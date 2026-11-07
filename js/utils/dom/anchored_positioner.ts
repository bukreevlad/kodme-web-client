/**
 * Параметры позиционирования плавающего элемента.
 */
export interface AnchoredPositionerData {
    /** Элемент, который позиционируем. */
    content: HTMLElement;
    /** Элемент-якорь (null — якоря нет). Если его нет, берётся `point`. */
    anchor?: HTMLElement | null;
    /** Точка в координатах вьюпорта (курсор при правом клике). Используется,
     * когда якоря-элемента нет; координаты могут быть не заполнены — такую
     * точку нормализация отбрасывает. */
    point?: PositionPointPartial | null;
    /** Элемент, внутри которого элемент обязан поместиться
     * (null — по умолчанию `document.documentElement`, то есть вьюпорт). */
    bounds?: HTMLElement | null;
    /** Сторона и выравнивание: строка либо пара `[side, align]`. */
    direction?: string | string[] | undefined;
    /** Отступ от якоря: число либо массив `[top, right, bottom, left]`. */
    margin?: number | number[] | undefined;
    /** Минимальный отступ от краёв bounds. */
    padding?: number;
    /** Что делать, если элемент не помещается. */
    fit?: FitMode | undefined;
    /** Элемент, относительно геометрии которого считаются `left`/`top`.
     * По умолчанию берётся `content.offsetParent`. */
    relativeTo?: HTMLElement | null;
}

/** Точка в координатах вьюпорта. */
export interface PositionPoint {
    x: number;
    y: number;
}

/** Точка с незаполненными координатами: такую точку нормализация
 * отбрасывает (частично заполненные координаты не считаем точкой). */
export interface PositionPointPartial {
    x?: number | undefined;
    y?: number | undefined;
}

/** Поведение при нехватке места: переворот стороны или ужатие. */
export type FitMode = "flip" | "shrink";

/** Раскладанные отступы от якоря по четырём сторонам. */
export interface MarginSides {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/** Разобранное направление: сторона привязки и выравнивание по поперечной оси. */
export interface DirectionParts {
    side: string;
    align?: string | undefined;
}

/** Прямоугольник в абсолютных координатах документа. */
export interface AbsRect {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/** Геометрия цели (якорь или точка) в абсолютных координатах документа. */
export interface TargetRect extends AbsRect {
    width: number;
    height: number;
}

/** Рассчитанные позиционные стили: заданы не все стороны, а только те,
 * что определяет направление. */
export interface PositionStyles {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

/** Нормализованные параметры (результат `_normalize`). */
interface NormalizedOptions {
    content: HTMLElement | null;
    anchor: HTMLElement | null;
    point: PositionPoint | null;
    margin: MarginSides;
    padding: number;
    fit: FitMode;
    direction: DirectionParts;
}

/** Смещение страницы: координаты считаем в системе документа. */
interface ScrollOffset {
    scrollX: number;
    scrollY: number;
}

/** Ниже этой высоты ужимать бессмысленно: окно лучше открыть целиком. */
const MIN_HEIGHT = 150;

/** CSS-стороны, которые могут попасть в результат расчёта позиции. */
const STYLE_SIDES: Array<keyof PositionStyles> = ["top", "bottom", "left", "right"];

/**
 * ***************************************************************************
 * ANCHORED_POSITIONER - Расчёт позиции плавающего элемента относительно якоря.
 *
 * Что делает:
 * позиционирует элемент (меню, поповер, выпадающий список) рядом с якорем —
 * с указанной стороны и выравниванием, с отступами и с коррекцией,
 * если элемент не помещается в отведённые границы.
 *
 * Зачем вынесено отдельно:
 * расчёт позиции нужен нескольким компонентам (модалки, контекстные меню,
 * поповеры), и держать его внутри компонента означает дублировать одну и ту же
 * геометрию. Здесь она живёт как обычная функция без привязки к компоненту.
 *
 * Якорь бывает двух видов, и это не деталь реализации:
 * - элемент (`anchor`) — кнопка или поле ввода, к которому привязан поповер;
 * - точка (`point`) — координаты курсора. Так открываются контекстные меню
 *   по правому клику: элемента-якоря там просто нет.
 * Если передан якорь, он важнее точки: элемент мог остаться с прошлого
 * открытия, а координаты курсора устарели.
 *
 * Что делать, когда элемент не помещается (`fit`):
 * - `"shrink"` (по умолчанию) — ограничить размер доступным местом и прижать
 *   к краю границ. Так ведут себя большие панели (эмодзи, меню бота): они
 *   умеют прокручиваться и обязаны остаться на той стороне, к которой
 *   привязаны, — переворачивать их под поле ввода нельзя.
 * - `"flip"` — сначала попробовать противоположную сторону от якоря, и только
 *   если не помогло, ужать. Так ведут себя меню: ужимать список пунктов вместо
 *   переворота нельзя, иначе длинное меню всегда станет прокручиваемым.
 *
 * Требования к вызывающему:
 * - `content` должен быть смонтирован в DOM (нужны реальные размеры);
 * - элемент позиционируется абсолютно внутри `relativeTo`.
 * ***************************************************************************
 */
export class AnchoredPositioner {

    /**
     * Позиционирует элемент относительно якоря.
     * @param data - Параметры позиционирования.
     * @returns true, если позиция рассчитана и применена.
     */
    static set(data: AnchoredPositionerData): boolean {

        const options = this._normalize(data);

        const { content, direction, margin, padding, fit } = options;

        // Мерять нечего, пока элемент не в DOM
        if (!content || !content.isConnected) return false;

        const targetAbs = this._targetRect(options);
        if (!targetAbs) return false;

        // Границы, внутри которых держим элемент
        const boundsEl = data.bounds || document.documentElement;
        const boundsRect = boundsEl.getBoundingClientRect();

        const { scrollX, scrollY } = this._scroll();
        const boundsAbs = this._absRect(boundsRect, scrollX, scrollY);

        // Сбрасываем предыдущую позицию, чтобы offsetWidth/offsetHeight
        // мерялись по содержимому, а не по прежним размерам
        this._resetStyles(content);

        // Стили позиционируем относительно элемента, заданного вызывающим.
        // Важно: `left`/`top` абсолютно спозиционированного элемента считаются
        // от его containing block, поэтому передавать сюда нужно именно тот
        // элемент, относительно которого вызывающий хочет получить координаты.
        const offsetParent = data.relativeTo || content.offsetParent || document.body;
        const parentAbs = this._absRect(offsetParent.getBoundingClientRect(), scrollX, scrollY);

        let elementWidth = content.offsetWidth || 0;
        let elementHeight = content.offsetHeight || 0;

        /** Раскладка по двум осям для указанного направления. */
        const place = (dir: DirectionParts): PositionStyles => Object.assign(
            this._calcVertical(dir, targetAbs, parentAbs, margin, elementHeight),
            this._calcHorizontal(dir, targetAbs, parentAbs, margin, elementWidth)
        );

        /** Вылезает ли элемент за границы хоть с одной стороны. */
        const isOutside = (styles: PositionStyles): boolean => this._isOutside(
            styles, parentAbs, boundsAbs, padding, elementWidth, elementHeight
        );

        let directionUsed: DirectionParts = direction;
        let finalStyles: PositionStyles = place(direction);

        // Переворот: меню уезжает на другую сторону от якоря, а не упирается
        // в край экрана. Переворачиваем только если не помогло ужатие —
        // иначе длинное меню у нижнего края стало бы прокручиваемым.
        if (fit === "flip" && isOutside(finalStyles)) {

            const mirrored = this._mirror(direction);

            if (mirrored) {
                const mirroredStyles = place(mirrored);
                if (!isOutside(mirroredStyles)) {
                    directionUsed = mirrored;
                    finalStyles = mirroredStyles;
                }
            }

        }

        // Ограничиваем размер доступным местом. При `shrink` — всегда,
        // при `flip` — только если элемент всё равно не помещается.
        if (fit !== "flip" || isOutside(finalStyles)) {

            const maxSize = this._maxSize(boundsRect, boundsAbs, targetAbs, directionUsed, margin, padding);

            content.style.maxHeight = `${Math.round(maxSize.height)}px`;
            content.style.maxWidth = `${Math.round(maxSize.width)}px`;

            // Замеряем уже после применения ограничений
            elementWidth = content.offsetWidth || 0;
            elementHeight = content.offsetHeight || 0;

            finalStyles = place(directionUsed);

        }

        // Коррекция: если элемент всё же вылез за границы — прижимаем к краю
        this._flipIfOverflow(finalStyles, parentAbs, boundsAbs, padding, elementWidth, elementHeight);

        // В режиме `flip` элемент обязан быть виден целиком, поэтому прижимаем
        // его ещё и по ближнему краю границ. Режим `shrink` этого не делает
        // намеренно: для большой панели важнее остаться на привязанной стороне
        // от якоря, чем уехать в угол. Именно так ведёт себя `Modal`, и эталонные
        // тесты требуют сохранить это поведение.
        if (fit === "flip") {
            this._clampInsideBounds(finalStyles, parentAbs, boundsAbs, padding);
        }

        // Применяем рассчитанные стороны: обходим только реально заданные
        // координаты (Object.keys здесь не нужен — список сторон фиксирован)
        for (const prop of STYLE_SIDES) {
            const value = finalStyles[prop];
            if (value === undefined) continue;
            content.style[prop] = `${Math.round(value)}px`;
        }

        return true;
    }

    /**
     * Приводит параметры к единому виду: раскрывает margin, direction, fit.
     * @param data - Исходные параметры.
     * @returns Нормализованные параметры.
     * @private
     */
    static _normalize(data: AnchoredPositionerData): NormalizedOptions {

        const content = data?.content || null;
        const anchor = data?.anchor || null;
        const paddingOption = data?.padding;
        const padding = typeof paddingOption === "number" ? paddingOption : 16;
        const fit: FitMode = data?.fit === "flip" ? "flip" : "shrink";

        // point приходит как `{x, y}`; частично заполненные координаты
        // точкой не считаем — иначе меню прыгнуло бы в угол экрана
        const pointOption = data?.point ?? null;
        let point: PositionPoint | null = null;
        if (
            pointOption
            && typeof pointOption.x === "number" && Number.isFinite(pointOption.x)
            && typeof pointOption.y === "number" && Number.isFinite(pointOption.y)
        ) {
            point = { x: pointOption.x, y: pointOption.y };
        }

        // margin: число или [top, right, bottom, left]
        const m = data?.margin;
        const margin: MarginSides = Array.isArray(m)
            ? { top: m[0] || 0, right: m[1] || 0, bottom: m[2] || 0, left: m[3] || 0 }
            : { top: m || 0, right: m || 0, bottom: m || 0, left: m || 0 };

        // direction: строка или [side, align]
        const dirOption = data?.direction;
        const dir: string[] = Array.isArray(dirOption) ? dirOption : [dirOption || "bottom"];

        return {
            content,
            anchor,
            point,
            margin,
            padding,
            fit,
            direction: { side: dir[0] ?? "", align: dir[1] ?? "" }
        };
    }

    /**
     * Смещение страницы: координаты якоря считаем в системе документа,
     * а не вьюпорта, иначе при прокрутке поповер отрывается от якоря.
     * @returns Смещение страницы.
     * @private
     */
    static _scroll(): ScrollOffset {
        return {
            scrollX: window.pageXOffset || document.documentElement.scrollLeft,
            scrollY: window.pageYOffset || document.documentElement.scrollTop
        };
    }

    /**
     * Переводит прямоугольник вьюпорта в систему координат документа.
     * @param rect - Прямоугольник из `getBoundingClientRect`.
     * @param scrollX - Смещение страницы по X.
     * @param scrollY - Смещение страницы по Y.
     * @returns Прямоугольник в абсолютных координатах.
     * @private
     */
    static _absRect(rect: DOMRect, scrollX: number, scrollY: number): AbsRect {
        return {
            top: rect.top + scrollY,
            bottom: rect.bottom + scrollY,
            left: rect.left + scrollX,
            right: rect.right + scrollX
        };
    }

    /**
     * Геометрия цели в абсолютных координатах: якорь-элемент либо точка.
     * @param options - Нормализованные параметры.
     * @returns Прямоугольник цели или null, если цели нет.
     * @private
     */
    static _targetRect(options: NormalizedOptions): TargetRect | null {

        const { anchor, point } = options;
        const { scrollX, scrollY } = this._scroll();

        // Якорь важнее точки: элемент мог остаться с прошлого открытия,
        // а координаты курсора к этому моменту уже неактуальны
        if (anchor && anchor.isConnected) {
            const rect = anchor.getBoundingClientRect();
            return {
                top: rect.top + scrollY,
                bottom: rect.bottom + scrollY,
                left: rect.left + scrollX,
                right: rect.right + scrollX,
                width: rect.width,
                height: rect.height
            };
        }

        // Точка — это прямоугольник нулевого размера
        if (point) {
            return {
                top: point.y + scrollY,
                bottom: point.y + scrollY,
                left: point.x + scrollX,
                right: point.x + scrollX,
                width: 0,
                height: 0
            };
        }

        return null;
    }

    /**
     * Противоположная сторона от якоря. Выравнивание не меняется: оно задано
     * по поперечной оси, а переворот меняет только основную.
     * @param direction - Разобранное направление.
     * @returns Зеркальное направление или null, если сторона неизвестна.
     * @private
     */
    static _mirror(direction: DirectionParts): DirectionParts | null {

        const sides: Record<string, string> = {
            top: "bottom",
            bottom: "top",
            left: "right",
            right: "left"
        };

        const side = sides[direction.side];
        if (!side) return null;

        return { side, align: direction.align };
    }

    /**
     * Максимальный размер элемента в отведённых границах.
     * Высота считается по той стороне, с которой элемент реально откроется:
     * ограничивать по «нижней» границе, когда панель уехала наверх, бессмысленно.
     * @param boundsRect - Границы из `getBoundingClientRect`.
     * @param boundsAbs - Границы в абсолютных координатах.
     * @param targetAbs - Геометрия цели в абсолютных координатах.
     * @param direction - Разобранное направление.
     * @param margin - Отступы от якоря.
     * @param padding - Минимальный отступ от краёв границ.
     * @returns Максимальный размер.
     * @private
     */
    static _maxSize(
        boundsRect: DOMRect,
        boundsAbs: AbsRect,
        targetAbs: TargetRect,
        direction: DirectionParts,
        margin: MarginSides,
        padding: number
    ): { height: number; width: number } {

        let height = boundsRect.height - (padding * 2);
        const width = boundsRect.width - (padding * 2);

        if (direction.side === "bottom") {
            height = boundsAbs.bottom - targetAbs.bottom - margin.bottom - padding;
        } else if (direction.side === "top") {
            height = targetAbs.top - boundsAbs.top - margin.top - padding;
        }

        // Если доступной высоты хватает впритык — не сжимаем элемент,
        // а возвращаем полную высоту границ
        if (height < MIN_HEIGHT) {
            height = boundsRect.height - (padding * 2);
        }

        return { height, width };
    }

    /**
     * Вылезает ли элемент за границы хотя бы одной стороной.
     * @param styles - Рассчитанные стили.
     * @param parentAbs - Геометрия offsetParent в абсолютных координатах.
     * @param boundsAbs - Границы в абсолютных координатах.
     * @param padding - Минимальный отступ от краёв.
     * @param elementWidth - Ширина позиционируемого элемента.
     * @param elementHeight - Высота позиционируемого элемента.
     * @returns true, если элемент выходит за границы.
     * @private
     */
    static _isOutside(
        styles: PositionStyles,
        parentAbs: AbsRect,
        boundsAbs: AbsRect,
        padding: number,
        elementWidth: number,
        elementHeight: number
    ): boolean {

        // Горизонталь: край считаем от того края, который реально задан стилем
        if (styles.left !== undefined) {
            const left = styles.left + parentAbs.left;
            if (left < boundsAbs.left + padding) return true;
            if (left + elementWidth > boundsAbs.right - padding) return true;
        }

        if (styles.right !== undefined) {
            const left = parentAbs.right - styles.right - elementWidth;
            if (left < boundsAbs.left + padding) return true;
            if (left + elementWidth > boundsAbs.right - padding) return true;
        }

        // Вертикаль
        if (styles.top !== undefined) {
            const top = styles.top + parentAbs.top;
            if (top < boundsAbs.top + padding) return true;
            if (top + elementHeight > boundsAbs.bottom - padding) return true;
        }

        if (styles.bottom !== undefined) {
            const top = parentAbs.bottom - styles.bottom - elementHeight;
            if (top < boundsAbs.top + padding) return true;
            if (top + elementHeight > boundsAbs.bottom - padding) return true;
        }

        return false;
    }

    /**
     * Сбрасывает позиционные стили перед замером.
     * @param content - Позиционируемый элемент.
     * @private
     */
    static _resetStyles(content: HTMLElement): void {
        content.style.position = "absolute";
        content.style.top = "auto";
        content.style.bottom = "auto";
        content.style.left = "auto";
        content.style.right = "auto";
        content.style.margin = "0";
        content.style.transform = "none";
        content.style.maxHeight = "none";
        content.style.maxWidth = "none";
        content.style.overflow = "auto";
    }

    /**
     * Считает вертикальную позицию относительно offsetParent.
     * @param direction - Разобранное направление.
     * @param targetAbs - Геометрия цели в абсолютных координатах.
     * @param parentAbs - Геометрия offsetParent в абсолютных координатах.
     * @param margin - Отступы от цели.
     * @param elementHeight - Высота позиционируемого элемента.
     * @returns Объект со свойством `top` или `bottom`.
     * @private
     */
    static _calcVertical(
        direction: DirectionParts,
        targetAbs: TargetRect,
        parentAbs: AbsRect,
        margin: MarginSides,
        elementHeight: number
    ): { top: number } | { bottom: number } {

        const { side, align } = direction;

        if (side === "top") {
            const targetEdge = targetAbs.top - margin.top;
            return { bottom: parentAbs.bottom - targetEdge };
        }

        if (side === "bottom") {
            const targetEdge = targetAbs.bottom + margin.bottom;
            return { top: targetEdge - parentAbs.top };
        }

        // Сторон нет — выравниваем по вертикали как по поперечной оси
        if (align === "bottom") {
            return { bottom: parentAbs.bottom - targetAbs.bottom + margin.bottom };
        }

        if (align === "top") {
            return { top: targetAbs.top - parentAbs.top + margin.top };
        }

        return { top: (targetAbs.top + targetAbs.height / 2 - elementHeight / 2) - parentAbs.top };
    }

    /**
     * Считает горизонтальную позицию относительно offsetParent.
     * @param direction - Разобранное направление.
     * @param targetAbs - Геометрия цели в абсолютных координатах.
     * @param parentAbs - Геометрия offsetParent в абсолютных координатах.
     * @param margin - Отступы от цели.
     * @param elementWidth - Ширина позиционируемого элемента.
     * @returns Объект со свойством `left` или `right`.
     * @private
     */
    static _calcHorizontal(
        direction: DirectionParts,
        targetAbs: TargetRect,
        parentAbs: AbsRect,
        margin: MarginSides,
        elementWidth: number
    ): { left: number } | { right: number } {

        const { side, align } = direction;

        if (side === "left") {
            const targetEdge = targetAbs.left - margin.left;
            return { right: parentAbs.right - targetEdge };
        }

        if (side === "right") {
            const targetEdge = targetAbs.right + margin.right;
            return { left: targetEdge - parentAbs.left };
        }

        // Сторон нет — выравниваем по горизонтали как по поперечной оси
        if (align === "right") {
            return { right: parentAbs.right - targetAbs.right + margin.right };
        }

        if (align === "left") {
            return { left: targetAbs.left - parentAbs.left + margin.left };
        }

        return { left: (targetAbs.left + targetAbs.width / 2 - elementWidth / 2) - parentAbs.left };
    }

    /**
     * Корректирует позицию, если элемент вылез за границы: прижимает к краю.
     * Переворот стороны к этому моменту уже отработан в `set`.
     * @param styles - Рассчитанные стили (мутируется на месте).
     * @param parentAbs - Геометрия offsetParent в абсолютных координатах.
     * @param boundsAbs - Границы в абсолютных координатах.
     * @param padding - Минимальный отступ от краёв.
     * @param elementWidth - Ширина элемента.
     * @param elementHeight - Высота элемента.
     * @private
     */
    static _flipIfOverflow(
        styles: PositionStyles,
        parentAbs: AbsRect,
        boundsAbs: AbsRect,
        padding: number,
        elementWidth: number,
        elementHeight: number
    ): void {

        // По горизонтали
        if (styles.left !== undefined) {
            const absX = styles.left + parentAbs.left;
            if (absX + elementWidth > boundsAbs.right - padding) {
                delete styles.left;
                styles.right = parentAbs.right - (boundsAbs.right - padding);
            }
        }

        if (styles.right !== undefined) {
            const absX = parentAbs.right - styles.right - elementWidth;
            if (absX < boundsAbs.left + padding) {
                delete styles.right;
                styles.left = (boundsAbs.left + padding) - parentAbs.left;
            }
        }

        // По вертикали
        if (styles.top !== undefined) {
            const absY = styles.top + parentAbs.top;
            if (absY + elementHeight > boundsAbs.bottom - padding) {
                delete styles.top;
                styles.bottom = parentAbs.bottom - (boundsAbs.bottom - padding);
            }
        }

        if (styles.bottom !== undefined) {
            const absY = parentAbs.bottom - styles.bottom - elementHeight;
            if (absY < boundsAbs.top + padding) {
                delete styles.bottom;
                styles.top = (boundsAbs.top + padding) - parentAbs.top;
            }
        }
    }

    /**
     * Прижимает элемент по ближнему (левому/верхнему) краю границ.
     *
     * `_flipIfOverflow` закрывает противоположный случай: он ловит выход
     * за дальний край и переносит элемент на `right`/`bottom`. Здесь — обратная
     * сторона: элемент вылез влево или вверх, и сдвинуть его надо, оставив
     * `left`/`top`.
     *
     * Вызывается только для `fit: "flip"`. Собранный из `Modal` расчёт
     * прижимает элемент только с одной стороны, и для панелей (режим `shrink`)
     * это оказалось правильным: лучше упереться в угол, чем уехать с
     * привязанной стороны якоря. Для меню (`fit: "flip"`) поведение другое —
     * они обязаны помещаться целиком, и раньше именно так и делал
     * `ContextMenu`, прижимая координаты с двух сторон.
     *
     * @param styles - Рассчитанные стили (мутируется на месте).
     * @param parentAbs - Геометрия offsetParent в абсолютных координатах.
     * @param boundsAbs - Границы в абсолютных координатах.
     * @param padding - Минимальный отступ от краёв границ.
     * @private
     */
    static _clampInsideBounds(
        styles: PositionStyles,
        parentAbs: AbsRect,
        boundsAbs: AbsRect,
        padding: number
    ): void {

        if (styles.left !== undefined) {
            const absX = styles.left + parentAbs.left;
            if (absX < boundsAbs.left + padding) {
                styles.left = (boundsAbs.left + padding) - parentAbs.left;
            }
        }

        if (styles.top !== undefined) {
            const absY = styles.top + parentAbs.top;
            if (absY < boundsAbs.top + padding) {
                styles.top = (boundsAbs.top + padding) - parentAbs.top;
            }
        }

    }

}
