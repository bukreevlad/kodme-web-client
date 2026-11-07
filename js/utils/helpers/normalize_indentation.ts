/**
 * ***************************************************************************
 * Подготавливает текст: выравнивает отступы по минимальному ненулевому.
 * @param text - Текст.
 * @returns Отформатированная строка.
 * ***************************************************************************
 */
export function normalizeIndentation(text: string): string {

    // Разбиваем на строки
    const lines = text.replace(/\t/g, "    ").split("\n");

    // Убираем пустые строки в начале и в конце
    while (lines.length && lines[0]?.trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1]?.trim() === "") lines.pop();

    // Игнорируем первую строку (зачастую без отступа)
    const linesToMeasure = lines.slice(1).filter(line => line.trim() !== "");
    const indents = linesToMeasure.map(line => line.match(/^ */)?.[0].length ?? 0);
    const minIndent = Math.min(...indents);

    // Возвращаем результат
    return lines.map((line, i) =>
        i === 0 ? line : line.slice(minIndent)
    ).join("\n");

}
