// Импортируем utils
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { SecretCall } from "../index.js";

/**
 * ***************************************************************************
 * formatDuration - форматирование секунд в mm:ss, после часа — hh:mm:ss.
 * Форматирование отдано общей утилите проекта (DurationFormatter), а не
 * написано здесь заново.
 * @param seconds - Количество секунд.
 * @returns Строка вида "05:03" или "01:05:03".
 * ***************************************************************************
 */
export function formatDuration(seconds: number): string {

    // Любое не-число показываем как ноль: таймер не имеет права
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
 * startTimer - запуск таймера длительности звонка (отсчёт от подключения).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function startTimer(form: SecretCall): void {

    try {

        // Форма могла переоткрыться — повторный запуск не нужен
        if (form.durationTimer) return;

        const startedAt = Date.now();

        // Рисуем значение сразу, иначе секунду пустует «00:00»
        const render = () => {
            const timer = form.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-timer]");
            if (timer) timer.textContent = formatDuration((Date.now() - startedAt) / 1000);
        };
        render();

        form.durationTimer = setInterval(render, 1000);

    } catch (error) {
        Logger.error("[app][secret-call]: не удалось запустить таймер звонка:", error);
    }

}

/**
 * ***************************************************************************
 * stopTimer - остановка таймера длительности звонка.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function stopTimer(form: SecretCall): void {

    if (form.durationTimer) {
        clearInterval(form.durationTimer);
        form.durationTimer = null;
    }

}
