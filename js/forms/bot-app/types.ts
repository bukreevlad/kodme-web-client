// Импортируем components (только типы)
import type { Overlay } from "../../components/overlay/index.js";
import type { OverlayGeometry, OverlayGeometryData } from "../../components/overlay/types.js";

/**
 * Данные формы WebApp-приложения бота.
 */
export interface BotAppData {

    /** Id приложения. */
    appId: string;

    /** Настройки формы. */
    options?: BotAppOptions;

}

/**
 * Настройки формы WebApp-приложения бота.
 */
export interface BotAppOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Модальное окно с капабилти `window_geometry` (тип «modal»).
 *
 * Методы геометрии (`saveGeometry`, `restoreGeometry`, `resetGeometry`,
 * `disableMove`/`enableMove`, `disableResize`/`enableResize`) и `setWrapPadding`
 * копируются на экземпляр динамически, поэтому базовый тип Overlay их не
 * описывает — здесь они объявлены явно, а проверка на месте делается
 * guard'ом `isWindowGeometryOverlay`.
 */
export interface WindowGeometryOverlay extends Overlay {

    /** Сохранённая геометрия окна перед «разворотом» (пишет maximizeHandler). */
    geometry?: OverlayGeometryData | null;

    /** Сохраняет текущие координаты и размеры окна. */
    saveGeometry(): OverlayGeometry | null;

    /** Восстанавливает размеры и позицию окна из переданной геометрии. */
    restoreGeometry(data: OverlayGeometryData): void;

    /** Сбрасывает ручные стили геометрии (возврат к Flexbox). */
    resetGeometry(): void;

    /** Отключает перемещение окна. */
    disableMove(): void;

    /** Включает перемещение окна. */
    enableMove(): void;

    /** Отключает изменение размеров окна. */
    disableResize(): void;

    /** Включает изменение размеров окна. */
    enableResize(): void;

    /** Задаёт классы отступов обёртки. */
    setWrapPadding(padding: string): void;

}

/**
 * Значение — модальное окно с капабилти `window_geometry`.
 * @param value - Проверяемое значение (модальное окно формы).
 * @returns true, если окно поддерживает методы геометрии.
 */
export function isWindowGeometryOverlay(value: unknown): value is WindowGeometryOverlay {

    if (typeof value !== "object" || value === null) return false;

    // Методы капабилти копируются на экземпляр в конструкторе Overlay —
    // достаточно проверить наличие хотя бы одного
    const methods = value as Record<string, unknown>;
    return typeof methods.saveGeometry === "function";

}
