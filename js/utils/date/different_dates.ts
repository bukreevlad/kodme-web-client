/**
 * ***************************************************************************
 * areDatesDifferent - определяем разницу дат: если даты отличаются — true
 * (время не учитывается).
 * @param dateOne - Первая дата (ISO-строка или timestamp); отсутствие даты —
 *   всегда «разные даты».
 * @param dateTwo - Вторая дата (ISO-строка или timestamp).
 * @returns true, если календарные даты различаются.
 * ***************************************************************************
 */
export function areDatesDifferent(
    dateOne: string | number | null | undefined,
    dateTwo: string | number
): boolean {

    // Если не переданы параметры
    if (!dateOne) return true;

    // Берем только дату (год-месяц-день) без времени
    const firstDate = new Date(dateOne).toDateString();
    const lastDate = new Date(dateTwo).toDateString();

    // Если даты разные
    return firstDate !== lastDate;

}
