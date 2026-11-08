// Импортируем config
import { CALL_TILE_INSET, CALL_TILE_DRAG_THRESHOLD } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем типы
import type { Call } from "../index.js";
import type { CallTileFraction } from "../types.js";

/**
 * Высота шапки или футера формы. Скрытая панель высоты не имеет.
 * @param panel - Шапка или футер.
 * @returns Высота в px.
 */
function getPanelHeight(panel: HTMLElement | null): number {

    if (!panel || panel.classList.contains("hidden")) return 0;

    return panel.offsetHeight || 0;

}

/**
 * Сдвиг мини-плитки от базового положения в px.
 */
interface CallTileArea {

    /** Максимальный сдвиг по X (вправо от базы, положительное число). */
    maxX: number;

    /** Максимальный сдвиг по Y (вверх от базы, положительное число). */
    maxY: number;

}

/**
 * ***************************************************************************
 * Считает, насколько мини-плитка может уехать от своего базового положения.
 *
 * Базовое положение задаёт CSS (роль .call-corner): правый нижний угол
 * рабочей области, то есть `right: inset` и `bottom: футер + inset` —
 * плитка сразу стоит НАД футером, даже если JS ещё не отработал. Сдвиг
 * уводит её только влево и вверх, до границ рабочей области.
 *
 * @param form - Экземпляр формы Call.
 * @param tile - Плашка «я» или мини-плитка собеседника.
 * @returns Максимальный сдвиг по осям в px (null — посчитать не удалось).
 * ***************************************************************************
 */
function getTileArea(form: Call, tile?: HTMLElement | null): CallTileArea | null {

    try {

        const content = form?.content;
        if (!content || !tile) return null;

        const rect = content.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const width = tile.offsetWidth || 128;
        const height = tile.offsetHeight || 171;

        // Границы рабочей области в координатах контента
        const minLeft = CALL_TILE_INSET;
        const minTop = getPanelHeight(form.header) + CALL_TILE_INSET;

        // Базовое положение — правый нижний угол. Футер не вычитаем:
        // CSS уже прижал плитку над ним
        const baseLeft = rect.width - width - CALL_TILE_INSET;
        const baseTop = rect.height - getPanelHeight(form.footer) - height - CALL_TILE_INSET;

        return {
            maxX: Math.max(baseLeft - minLeft, 0),
            maxY: Math.max(baseTop - minTop, 0)
        };

    } catch {
        return null;
    }

}

/**
 * ***************************************************************************
 * Позиция мини-плитки как доля рабочей области.
 *
 * Позиция общая для плашки «я» и мини-плитки собеседника: на экране они
 * никогда не встречаются одновременно — когда одно видео крупное, второе
 * мини. Поэтому после обмена местами плитка встаёт ровно туда, где стояла.
 *
 * Хранится в долях, а не в px, поэтому при повороте экрана плашка
 * остаётся в той же относительной точке.
 * x: 0 — у правого края, 1 — у левого; y: 0 — низ, 1 — верх.
 *
 * @param form - Экземпляр формы Call.
 * @returns Позиция в долях 0..1.
 * ***************************************************************************
 */
function getTileFraction(form: Call): CallTileFraction {

    if (!form.tileFraction) {
        form.tileFraction = { x: 0, y: 0 };
    }

    return form.tileFraction;

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
 * Переводит позицию в долях в CSS-сдвиг и применяет к мини-плитке.
 * @param form - Экземпляр формы Call.
 * @param tile - Плашка «я» или мини-плитка собеседника.
 * @param x - Позиция по X в долях 0..1.
 * @param y - Позиция по Y в долях 0..1.
 * @returns Итоговая позиция в долях.
 * ***************************************************************************
 */
function applyTileFraction(form: Call, tile: HTMLElement | null, x: number, y: number): CallTileFraction {

    const fraction = { x: clamp01(x), y: clamp01(y) };

    // Запоминаем: это и есть текущая позиция, из неё считаем сдвиг
    // при любом пересчёте (ресайз, поворот экрана)
    form.tileFraction = fraction;

    const area = getTileArea(form, tile);
    if (!tile || !area) return fraction;

    // Сдвиг всегда вверх и влево от базового положения
    const shiftX = area.maxX ? -fraction.x * area.maxX : 0;
    const shiftY = area.maxY ? -fraction.y * area.maxY : 0;

    tile.style.setProperty("--call-tile-shift-x", `${Math.round(shiftX)}px`);
    tile.style.setProperty("--call-tile-shift-y", `${Math.round(shiftY)}px`);

    return fraction;

}

/**
 * ***************************************************************************
 * Ставит переданную плитку в текущую точку рабочей области.
 * @param form - Экземпляр формы.
 * @param tile - Плашка «я» или мини-плитка собеседника.
 * @returns {void}
 * ***************************************************************************
 */
export function placeTile(form: Call, tile?: HTMLElement | null): void {

    try {

        const fraction = getTileFraction(form);
        applyTileFraction(form, tile ?? null, fraction.x, fraction.y);

    } catch (error) {
        Logger.debug("[app][call]: Не удалось разместить мини-плитку", error);
    }

}

/**
 * ***************************************************************************
 * Ставит плашку «я» в текущую точку рабочей области.
 *
 * Вызывается при открытии формы и при ресайзе/повороте экрана: позиция
 * хранится в долях, поэтому переживает любые изменения размеров.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function placeSelfTile(form: Call): void {

    // На сцене плашка занимает всю рабочую область — двигать её нечего
    if (form?.selfTile?.classList.contains("call-stage")) return;

    placeTile(form, form?.miniDragTile || form?.selfTile);

}

/**
 * ***************************************************************************
 * Показывает плашку «я», только когда в ней есть видео.
 *
 * Видимость завязана на содержимое, а не на состояние звонка. Во время
 * прозвона плашка обязана оставаться на виду: вызывающий включил камеру,
 * чтобы видеть себя, а оверлей вызова её не перекрывает — плашка держится
 * выше него по слоям (см. z-index роли .call-corner в css/forms/call.css).
 *
 * Правило применяется в двух местах — здесь же, в set_state.ts, и в
 * events/store/item_added.ts, где в плашку впервые попадает видео.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function syncSelfTileVisibility(form: Call): void {

    form?.selfTile?.classList.toggle("hidden", !form?.selfTile?.firstElementChild);

}

/**
 * ***************************************************************************
 * Включает перетаскивание мини-плитки.
 *
 * Жест обычный: зажать и потянуть. Плитка прижата к углу и двигается
 * сдвигом, поэтому позиция считается от базового положения, а не от
 * координаты курсора. Работает и мышью, и пальцем — GestureController
 * сам разбирает тип ввода, а `touch-action: none` в CSS не даёт системному
 * скроллу перехватить жест на PWA.
 *
 * @param form - Экземпляр формы.
 * @param tile - Плашка «я» или мини-плитка собеседника.
 * @returns {void}
 * ***************************************************************************
 */
function initTileDrag(form: Call, tile?: HTMLElement | null): void {

    try {

        if (!tile || form.miniDragTile === tile) return;

        // Отключаем системное «перетаскивание» содержимого плитки
        tile.style.touchAction = "none";

        let startFraction = { x: 0, y: 0 };
        let startArea: CallTileArea | null = null;
        let isDragging = false;

        form.tileDrag?.destroy();
        form.miniDragTile = tile;

        form.tileDrag = new GestureController(tile, {
            threshold: 4,
            pan: {
                freeMove: true,
                onStart: () => {

                    isDragging = true;
                    startFraction = { ...getTileFraction(form) };
                    startArea = getTileArea(form, tile);
                    tile.classList.add("is-dragging");
                },
                onMove: (dx, dy) => {
                    if (!isDragging) return;

                    const area = startArea || getTileArea(form, tile);
                    if (!area) return;

                    // Жест двигает в px, позиция хранится в долях —
                    // так она переживает изменение размеров формы
                    const x = area.maxX ? startFraction.x - dx / area.maxX : startFraction.x;
                    const y = area.maxY ? startFraction.y - dy / area.maxY : startFraction.y;

                    applyTileFraction(form, tile, x, y);
                },
                onEnd: (dx, dy) => {
                    if (!isDragging) return;
                    isDragging = false;
                    tile.classList.remove("is-dragging");

                    // После перетаскивания click всё равно приходит:
                    // помечаем перемещение, чтобы он не выбрал плитку.
                    // Сброс через 300мс: click — отдельная задача event-цикла,
                    // 0мс-таймер отработал бы раньше него
                    if (Math.hypot(dx, dy) > CALL_TILE_DRAG_THRESHOLD) {
                        form.selfViewDragMoved = true;
                        if (form.selfViewDragMovedTimer !== null) clearTimeout(form.selfViewDragMovedTimer);
                        form.selfViewDragMovedTimer = setTimeout(() => {
                            form.selfViewDragMoved = false;
                        }, 300);
                    }
                }
            }
        });

    } catch (error) {
        Logger.error("🚨 [app][call]: Ошибка при инициализации перетаскивания мини-плитки", error);
    }

}

/**
 * ***************************************************************************
 * Включает перетаскивание плашки «я».
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function initSelfDrag(form: Call): void {

    initTileDrag(form, form?.selfTile);

}

/**
 * ***************************************************************************
 * Привязывает перетаскивание к тому, кто сейчас мини.
 *
 * В spotlight при обмене местами мини-плиткой становится собеседник, а не
 * «я» — жест должен следовать за ней. Позиция при этом общая, поэтому после
 * обмена плитка встаёт ровно туда, где стояла предыдущая.
 * @param form - Экземпляр формы.
 * @param tile - Элемент, который сейчас в углу.
 * @returns {void}
 * ***************************************************************************
 */
export function syncMiniTileDrag(form: Call, tile?: HTMLElement | null): void {

    // Угол пуст (сетка): жест снимается, иначе контроллер держал бы
    // перетаскивание на плитке, которая теперь равная ячейка сетки.
    // Долю позиции при этом не чистим — после возврата в пару или фокус
    // мини-плитка встанет туда, где стояла
    if (!tile) {
        form.tileDrag?.destroy();
        form.tileDrag = null;
        form.miniDragTile = null;
        return;
    }

    initTileDrag(form, tile);
    placeTile(form, tile);

}

/**
 * ***************************************************************************
 * Снимает обработчики перетаскивания мини-плитки (закрытие формы).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function destroySelfDrag(form: Call): void {

    try {

        form.tileDrag?.destroy();
        form.tileDrag = null;
        form.miniDragTile = null;
        form.tileFraction = null;

    } catch (error) {
        Logger.debug("[app][call]: Не удалось снять перетаскивание плашки", error);
    }

}
