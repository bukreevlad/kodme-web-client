/**
 * Результат вычисления соотношения сторон.
 */
export interface AspectRatio {

    /** Отношение сторон строкой, например "16:9". */
    ratio: string;

    /** Десятичное значение отношения ширин. */
    decimal: number;

    /** Упрощённые значения: [ширина, высота]. */
    simplified: [number, number];

}

/**
 * ***************************************************************************
 * Вычисление aspect ratio (наибольший общий делитель).
 * @param {number} [width] - Ширина (undefined → вернёт null).
 * @param {number} [height] - Высота (undefined → вернёт null).
 * @returns Отношение сторон или null, если одну из сторон не передали.
 * ***************************************************************************
 */
export function calculateAspectRatio(width?: number, height?: number): AspectRatio | null {

    if (!width || !height) return null;

    // Функция для нахождения наибольшего общего делителя (НОД)
    function gcd(a: number, b: number): number {
        return b === 0 ? a : gcd(b, a % b);
    }

    const divisor = gcd(width, height);
    const aspectWidth = width / divisor;
    const aspectHeight = height / divisor;

    return {
        ratio: `${aspectWidth}:${aspectHeight}`,
        decimal: width / height,
        simplified: [aspectWidth, aspectHeight]
    };

}
