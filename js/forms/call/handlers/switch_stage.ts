// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { applyViewMode } from "../functions/apply_view_mode.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Переводит участника на сцену по клику на его плитку.
 *
 * Сцену занимает тот, чей identity лежит в `form.stageIdentity`, поэтому
 * здесь нет ветвления по режимам — достаточно записать identity и
 * пересобрать раскладку:
 *
 *   - `spotlight` (двое) — клик по угловой плитке меняет видео местами,
 *     потому что в паре непременно остаётся один несценический и он уходит
 *     в угол. Клик по сцене сюда не доходит: это тап по видео, и он
 *     управляет иммерсивным режимом;
 *   - `grid` — клик по любой плитке отправляет её на сцену (focus);
 *   - `focus` — остальные участники спрятаны, добраться сюда нельзя;
 *     выйти из режима можно только кнопкой «в сетку».
 *
 * Вызов одинаков для чужих плиток и для плашки «я».
 * @param form - Экземпляр формы.
 * @param identity - Identity участника.
 * @param element - Элемент, по которому кликнули.
 * @returns {void}
 * ***************************************************************************
 */
export function switchStageHandler(form: Call, identity?: string | null, element?: HTMLElement | null): void {

    try {

        if (!identity) return;

        // Тап по сцене — это иммерсивный режим: два жеста на одном
        // месте сделали бы противоположные вещи
        if (element?.classList.contains("call-stage")) return;

        // Сетки нет ни в паре, ни в режиме фокуса — менять нечего
        if (form?.viewMode !== "spotlight" && form?.viewMode !== "grid") return;

        form.stageIdentity = identity;

        applyViewMode(form);

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось сменить участника на сцене", error);
    }

}
