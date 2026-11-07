/**
 * Типы аудиоплеера: guard'ы для внешних данных метаданных трека.
 */

// Импортируем utils
import type { Thumbnail } from "../../utils/helpers/get_thumbnail_size_query.js";

/**
 * Guard для поля `thumbnails` из метаданных трека: проверяет, что значение —
 * непустой список превью с числовой шириной (контракт getThumbnailSizeQuery).
 * @param value - Проверяемое значение.
 * @return true, если значение — валидный список превью.
 */
export function isThumbnails(value: unknown): value is Thumbnail[] {
    return Array.isArray(value) && value.length > 0 && value.every(
        (item: unknown) => typeof item === "object" && item !== null && "width" in item && typeof item.width === "number",
    );
}

/**
 * Guard для поля `wave_form` из метаданных трека: проверяет, что значение —
 * непустой список амплитуд (чисел 0..1) для отрисовки осциллограммы.
 * @param value - Проверяемое значение.
 * @return true, если значение — валидный список амплитуд.
 */
export function isWaveFormAmplitudes(value: unknown): value is number[] {
    return Array.isArray(value) && value.length > 0 && value.every(
        (item: unknown) => typeof item === "number",
    );
}
