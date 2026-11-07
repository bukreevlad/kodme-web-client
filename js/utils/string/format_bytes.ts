/**
 * ***************************************************************************
 * Вспомогательный метод для форматирования байтов.
 * @param bytes - Размер в байтах.
 * @param float - Количество знаков после запятой (по умолчанию 2).
 * @returns Отформатированная строка, например "100 МБ".
 * ***************************************************************************
 */
export function formatBytes(bytes: number, float = 2): string {

    if (0 == bytes) return "0 б.";
    const c = 1024;
    const d = float || 2;
    const e = window._lc.utils.format_bites.sizes; // В локализации
    const f = Math.floor(Math.log(bytes) / Math.log(c));

    return `${parseFloat((bytes / Math.pow(c, f)).toFixed(d))} ${e[f]}.`;

}
