/**
 * ***************************************************************************
 * isOneOf - проверка значения по списку допустимых вариантов.
 *
 * Универсальный type guard вместо копий `arr.some(item => item === value)`
 * в компонентах: значение из JSON (строка) сверяется со списком констант
 * компонента, после чего сужается до union-типа этого списка.
 * @param {string | undefined | null} value - Проверяемое значение.
 * @param {readonly T[]} options - Допустимые варианты.
 * @returns {boolean} - true, если значение есть в списке.
 * ***************************************************************************
 */
export function isOneOf<T extends string>(value: string | undefined | null, options: readonly T[]): value is T {
    return options.some(item => item === value);
}
