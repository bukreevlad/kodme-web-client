// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем типы
import type { SecretCall } from "../index.js";

// Отступ плашки от краёв рабочей области (px)
const TILE_INSET = 12;

// Свайг плашки длиннее этого сдвига (px) не считается кликом
const TILE_DRAG_THRESHOLD = 6;

// Задержка сброса флага перетаскивания (мс): click приходит отдельной
// задачей event-цикла после touchend
const TILE_DRAG_RESET_DELAY = 300;

/**
 * Высота панели формы (0 — панель скрыта).
 * @param panel - Панель.
 * @returns Высота в px.
 */
function getPanelHeight(panel: HTMLElement | null): number {
    if (!panel || panel.classList.contains("hidden")) return 0;
    return panel.offsetHeight || 0;
}

/**
 * Максимальный сдвиг угловой плашки от базового положения (px).
 */
interface TileArea {

    /** Максимальный сдвиг по X (влево от базы, положительное число). */
    maxX: number;

    /** Максимальный сдвиг по Y (вверх от базы, положительное число). */
    maxY: number;

}

/**
 * ***************************************************************************
 * Считает, насколько угловая плашка может уехать от базового положения
 * (правый нижний угол рабочей области — его задаёт CSS класса
 * .secret-call-corner): сдвиг уводит её только влево и вверх.
 * @param form - Экземпляр формы.
 * @returns Максимальный сдвиг по осям либо null (посчитать не удалось).
 * ***************************************************************************
 */
function getTileArea(form: SecretCall): TileArea | null {

    try {

        const content = form.tpl?.querySelector<HTMLElement>(":scope >[data-content]");
        const tile = form.tpl?.querySelector<HTMLElement>(":scope [data-self-tile]");
        if (!content || !tile) return null;

        const rect = content.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const width = tile.offsetWidth || 128;
        const height = tile.offsetHeight || 171;

        const minLeft = TILE_INSET;
        const minTop = getPanelHeight(form.tpl?.querySelector<HTMLElement>(":scope >[data-header]") ?? null) + TILE_INSET;

        // Базовое положение — правый нижний угол (футер плашка не пересекает:
        // CSS прижал её над ним)
        const baseLeft = rect.width - width - TILE_INSET;
        const baseTop = rect.height - height - 5.5 * 16;

        return {
            maxX: Math.max(baseLeft - minLeft, 0),
            maxY: Math.max(baseTop - minTop, 0)
        };

    } catch {
        return null;
    }

}

/**
 * Ограничивает значение диапазоном 0..1.
 * @param value - Значение.
 * @returns Значение из диапазона.
 */
function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/**
 * ***************************************************************************
 * Переводит позицию плашки (в долях рабочей области) в CSS-сдвиг.
 * Позиция хранится в долях, поэтому переживает повороты экрана.
 * @param form - Экземпляр формы.
 * @param x - Позиция по X в долях 0..1.
 * @param y - Позиция по Y в долях 0..1.
 * @returns void
 * ***************************************************************************
 */
function applyTileFraction(form: SecretCall, x: number, y: number): void {

    const fraction = { x: clamp01(x), y: clamp01(y) };
    form.tileFraction = fraction;

    const tile = form.tpl?.querySelector<HTMLElement>(":scope [data-self-tile]") ?? null;
    const area = getTileArea(form);
    if (!tile || !area) return;

    // Сдвиг всегда вверх и влево от базового положения
    const shiftX = area.maxX ? -fraction.x * area.maxX : 0;
    const shiftY = area.maxY ? -fraction.y * area.maxY : 0;

    tile.style.setProperty("--secret-call-shift-x", `${Math.round(shiftX)}px`);
    tile.style.setProperty("--secret-call-shift-y", `${Math.round(shiftY)}px`);

}

/**
 * ***************************************************************************
 * Обмен видео местами: видео из угловой плашки уходит на сцену, видео со
 * сцены — в плашку (по клику на плашку, как в обычном звонке).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function swapTiles(form: SecretCall): void {

    try {

        const stage = form.tpl?.querySelector<HTMLElement>(":scope [data-peer-tile]");
        const corner = form.tpl?.querySelector<HTMLElement>(":scope [data-self-tile]");
        if (!stage || !corner) return;

        const stageVideo = stage.querySelector("video");
        const cornerVideo = corner.querySelector("video");
        if (!stageVideo || !cornerVideo) return;

        // Переносим сами видео: атрибуты data-*-video остаются на элементах,
        // подписки менеджера продолжают их находить
        stage.append(cornerVideo);
        corner.append(stageVideo);
        form.selfInCorner = !form.selfInCorner;

    } catch (error) {
        Logger.error("[app][secret-call]: не удалось поменять видео местами:", error);
    }

}

/**
 * ***************************************************************************
 * Включает перетаскивание угловой плашки и обмен видео по клику.
 *
 * Жест обычный: зажать и потянуть (мышью и пальцем — GestureController
 * сам разбирает тип ввода). Клик после перетаскивания обменом не считается.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function initSelfDrag(form: SecretCall): void {

    try {

        const tile = form.tpl?.querySelector<HTMLElement>(":scope [data-self-tile]");
        if (!tile || form.tileDrag) return;

        let isDragging = false;
        let startFraction = { x: 0, y: 0 };
        let startArea: TileArea | null = null;

        form.tileDrag = new GestureController(tile, {
            threshold: 4,
            pan: {
                freeMove: true,
                onStart: () => {
                    isDragging = true;
                    startFraction = { ...(form.tileFraction ?? { x: 0, y: 0 }) };
                    startArea = getTileArea(form);
                    tile.classList.add("is-dragging");
                },
                onMove: (dx, dy) => {
                    if (!isDragging) return;

                    const area = startArea || getTileArea(form);
                    if (!area) return;

                    const x = area.maxX ? startFraction.x - dx / area.maxX : startFraction.x;
                    const y = area.maxY ? startFraction.y - dy / area.maxY : startFraction.y;
                    applyTileFraction(form, x, y);
                },
                onEnd: (dx, dy) => {
                    if (!isDragging) return;
                    isDragging = false;
                    tile.classList.remove("is-dragging");

                    // После перетаскивания браузер всё равно отправит click —
                    // помечаем факт перемещения, чтобы клик не стал обменом
                    if (Math.hypot(dx, dy) > TILE_DRAG_THRESHOLD) {
                        form.tileDragMoved = true;
                        if (form.tileDragMovedTimer !== null) clearTimeout(form.tileDragMovedTimer);
                        form.tileDragMovedTimer = setTimeout(() => {
                            form.tileDragMoved = false;
                        }, TILE_DRAG_RESET_DELAY);
                    }
                }
            }
        });

        // Клик по плашке — обмен видео местами (кроме клика после драга)
        tile.addEventListener("click", () => {
            if (form.tileDragMoved) {
                form.tileDragMoved = false;
                return;
            }
            swapTiles(form);
        });

    } catch (error) {
        Logger.error("[app][secret-call]: не удалось включить перетаскивание плашки:", error);
    }

}

/**
 * ***************************************************************************
 * Снимает обработчики перетаскивания угловой плашки (закрытие формы).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function destroySelfDrag(form: SecretCall): void {

    try {

        form.tileDrag?.destroy();
        form.tileDrag = null;
        form.tileFraction = null;

    } catch (error) {
        Logger.debug("[app][secret-call]: не удалось снять перетаскивание плашки", error);
    }

}
