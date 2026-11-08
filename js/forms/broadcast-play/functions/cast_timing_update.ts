// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * CAST_TIMING_UPDATE - обновляет чип длительности эфира (каждую секунду).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function castTimingUpdate(form: BroadcastPlay): void {

    try {

        // Конвертируем дату старта в миллисекунды (UTC timestamp)
        const startedAtMs = new Date(form.cast?.started_at || 0).getTime();

        // Даты нет или она невалидна — таймер показывает нули
        if (isNaN(startedAtMs) || startedAtMs === 0) {
            Logger.warn("Таймер: Невалидная дата старта.");
            if (form.timing) form.timing.textContent = "00:00";
            return;
        }

        // Сколько прошло в миллисекундах (текущее время - время старта).
        // Math.max защищает от отрицательного значения, если часы клиента
        // отстали от серверного времени старта
        const duration = Math.max(0, Date.now() - startedAtMs);

        // Отображаем время
        if (form.timing) form.timing.textContent = new DurationFormatter(duration).getFormattedDuration();

    } catch (error) {
        Logger.error(error);
    }

}
