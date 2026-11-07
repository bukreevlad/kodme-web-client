// Импортируем utils
import { calculateAspectRatio } from "../helpers/calculate_aspect_ratio.js";

/**
 * ***************************************************************************
 * applyAspectRatio - проставляет пропорции элементам вложения.
 *
 * Зачем helper, а не просто calculateAspectRatio: у сетки вложений в CSS уже
 * есть осмысленные значения по умолчанию — квадрат для плитки (1/1) и 16/9
 * для одиночного вложения. Если подставить инлайновый 1/1 «на всякий случай»,
 * он перебьёт CSS-правило для одного элемента, и одиночное видео снова станет
 * квадратным. Поэтому если реальные пропорции неизвестны и фолбэк явно не
 * задан — стиль не трогаем, пусть решает CSS.
 *
 * @param {Array<HTMLElement | null>} elements - Элементы (контейнер, placeholder, thumbnail).
 * @param {number} [width] - Ширина оригинала.
 * @param {number} [height] - Высота оригинала.
 * @param {[number, number] | null} [fallback=null] - Пропорции по умолчанию [w, h], если нужны.
 * @returns {boolean} - true, если пропорции взяты из оригинала, а не из фолбэка.
 * ***************************************************************************
 */
export function applyAspectRatio(
    elements: Array<HTMLElement | null>,
    width?: number,
    height?: number,
    fallback: [number, number] | null = null
): boolean {

    const ratio = calculateAspectRatio(width, height);

    // Пропорции неизвестны и фолбэк не задан — оставляем как есть
    if (!ratio && !fallback) return false;

    const value = ratio
        ? `${ratio.simplified[0]}/${ratio.simplified[1]}`
        // Ветка фолбэка достижима только при заданном fallback (проверено выше);
        // `?? ""` защищает тип в недостижимом случае с null
        : `${fallback?.[0] ?? ""}/${fallback?.[1] ?? ""}`;

    for (const element of elements) {
        if (!element) continue;
        element.style.aspectRatio = value;
    }

    return Boolean(ratio);

}
