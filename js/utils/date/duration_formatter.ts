// Импортируем utils
import { t } from "../i18n/index.js";

/**
 * Опции форматирования продолжительности.
 */
export interface DurationFormatOptions {

    /** Включать ли секунды в формат (DD:HH:MM:SS или DD:HH:MM). По умолчанию true. */
    includeSeconds?: boolean;

    /** Включать ли дни в вывод (например, "1 день 05:00:00"). По умолчанию true. */
    includeDays?: boolean;

    /** Убирать ли нулевые значения (например, "15:57" вместо "00:15:57"). По умолчанию true. */
    trimEmptyUnits?: boolean;

}

/**
 * ***************************************************************************
 * DurationFormatter
 * Класс для форматирования продолжительности времени (например, таймер, обратный отсчет)
 * в формат [X дней] HH:MM:SS.
 * ***************************************************************************
 */
export class DurationFormatter {

    // Константы в миллисекундах
    static MS_PER_SECOND = 1000;
    static MS_PER_MINUTE = 60 * this.MS_PER_SECOND;
    static MS_PER_HOUR = 60 * this.MS_PER_MINUTE;
    static MS_PER_DAY = 24 * this.MS_PER_HOUR;

    /** Продолжительность в целых миллисекундах (всегда неотрицательная). */
    readonly durationMs: number;

    /**
     * @param durationMs - Продолжительность времени в миллисекундах.
     */
    constructor(durationMs: number) {
        if (typeof durationMs !== "number" || durationMs < 0) {
            this.durationMs = 0;
            // Можно добавить предупреждение, но для форматирования всегда используем 0 или позитивное значение.
        } else {
            // Используем Math.floor для гарантии целого числа миллисекунд
            this.durationMs = Math.floor(durationMs);
        }
    }

    /**
     * ***************************************************************************
     * Получает отформатированную строку продолжительности.
     * @param options - Опции (см. DurationFormatOptions).
     * @returns Отформатированная строка продолжительности.
     * ***************************************************************************
     */
    getFormattedDuration(options: DurationFormatOptions = {}): string {
        // Деструктуризация с дефолтными значениями (защищает от неполного объекта options)
        const {
            includeSeconds = true,
            includeDays = true,
            trimEmptyUnits = true
        } = options;

        let remaining = Math.max(0, Math.floor(this.durationMs));

        // 1. Расчет Дней
        const days = Math.floor(remaining / DurationFormatter.MS_PER_DAY);
        remaining %= DurationFormatter.MS_PER_DAY;

        // 2. Расчет Часов
        let hours = Math.floor(remaining / DurationFormatter.MS_PER_HOUR);
        remaining %= DurationFormatter.MS_PER_HOUR;

        // 3. Расчет Минут
        const minutes = Math.floor(remaining / DurationFormatter.MS_PER_MINUTE);
        remaining %= DurationFormatter.MS_PER_MINUTE;

        // 4. Расчет Секунд
        const seconds = Math.floor(remaining / DurationFormatter.MS_PER_SECOND);

        const pad = (num: number): string => num.toString().padStart(2, "0");

        // Определяем, будут ли дни отображаться отдельным текстом
        const showDays = days > 0 && includeDays;

        // Если дни есть, но в вывод их включать не нужно — переводим их в часы
        if (days > 0 && !includeDays) {
            hours += days * 24;
        }

        // Формируем массив фрагментов времени
        const parts: string[] = [];

        // Добавляем часы, если:
        // 1. Обрезка отключена (!trimEmptyUnits)
        // 2. Часы больше 0
        // 3. Выводятся дни (например, "1 день 00:15:30" — здесь часы являются частью полного формата)
        if (!trimEmptyUnits || hours > 0 || showDays) {
            parts.push(pad(hours));
        }

        // Минуты присутствуют всегда
        parts.push(pad(minutes));

        // Секунды добавляются по флагу
        if (includeSeconds) {
            parts.push(pad(seconds));
        }

        const timePart = parts.join(":");

        // 5. Формирование финальной строки
        if (showDays) {
            const dayText = `${days} ${t("utils.duration_formatter.days", { count: days })}`;
            return `${dayText} ${timePart}`;
        }

        return timePart;
    }

}
