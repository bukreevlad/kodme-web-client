// Импортируем utils
import { DurationFormatter } from "../date/duration_formatter.js";

/**
 * Метадата вложения: интересует длительность из original.duration.
 *
 * Поля объявлены совместимо с контрактом метадаты (`MediaOriginal`):
 * duration — число либо null у файлов без известной длительности, строка
 * возможна у серверных ответов старого формата.
 */
interface AttachmentMetadata {
    /** Оригинальные метаданные файла (собирает сервер). */
    original?: {
        /** Длительность в секундах (строка либо число). */
        duration?: string | number | null;
    };
}

/**
 * ***************************************************************************
 * applyDurationLabel - проставляет длительность в бейдж вложения.
 *
 * При неизвестной длительности бейдж прячется: ложное «00:00» хуже
 * пустого квадратика.
 *
 * @param {HTMLElement | null} element - Контейнер бейджа.
 * @param {AttachmentMetadata} [metadata] - Метадата вложения.
 * @returns {boolean} - true, если длительность распознана и показана.
 * ***************************************************************************
 */
export function applyDurationLabel(element: HTMLElement | null, metadata?: AttachmentMetadata): boolean {

    if (!element) return false;

    const seconds = Number(metadata?.original?.duration);

    // Не число, ноль или отрицательное — показывать нечего
    if (!Number.isFinite(seconds) || seconds <= 0) {
        element.classList.add("hidden");
        return false;
    }

    element.classList.remove("hidden");
    element.textContent = new DurationFormatter(seconds * 1000)
        .getFormattedDuration({ includeSeconds: true, includeDays: false });

    return true;

}
