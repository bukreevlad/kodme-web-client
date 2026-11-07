// Импортируем utils
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Форматирует количество секунд в вид mm:ss, а после часа — hh:mm:ss.
 *
 * Форматирование отдано общей утилите проекта (js/utils/date/duration_formatter.ts),
 * а не написано здесь заново: разбор «часы/минуты/секунды» в проекте уже есть,
 * и вторая копия однажды разойдётся с первой.
 * @param seconds - Количество секунд.
 * @returns Строка вида "05:03" или "01:05:03".
 * ***************************************************************************
 */
export function formatDuration(seconds: number): string {

    // Любое не-число показываем как ноль: таймер в шапке не имеет права
    // печатать «NaN:NaN:NaN»
    const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;

    return new DurationFormatter(total * 1000).getFormattedDuration({
        includeSeconds: true,
        includeDays: false,
        trimEmptyUnits: true
    });

}

/**
 * ***************************************************************************
 * Запускает таймер длительности звонка в шапке формы.
 *
 * Отсчёт идёт от момента, когда собеседник реально оказался в комнате
 * (см. functions/activate.ts), а не от открытия формы: прозвон разговором
 * не считается, и у обеих сторон таймер должен почти совпадать.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function startTimer(form: Call): void {

    try {

        // Форма может переоткрываться — повторный запуск не нужен
        if (form.durationTimer) return;

        const startedAt = Date.now();

        // Рисуем значение сразу, иначе в шапке секунду пустует «00:00»
        const first = form.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-timer]");
        if (first) first.textContent = formatDuration(elapsedSeconds(startedAt));

        form.durationTimer = setInterval(() => {
            const timer = form.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-timer]");
            if (!timer) return;
            timer.textContent = formatDuration(elapsedSeconds(startedAt));
        }, 1000);

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось запустить таймер звонка:", error);
    }

}

/**
 * ***************************************************************************
 * Сколько секунд прошло с момента начала звонка.
 * @param startedAt - Отметка времени начала (мс).
 * @returns Количество секунд, не меньше нуля.
 * ***************************************************************************
 */
function elapsedSeconds(startedAt: number): number {
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * ***************************************************************************
 * Останавливает таймер длительности звонка.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function stopTimer(form: Call): void {

    if (!form?.durationTimer) return;
    clearInterval(form.durationTimer);
    form.durationTimer = null;

}
