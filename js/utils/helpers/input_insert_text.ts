/**
 * ***************************************************************************
 * Вставка текста в месте курсора с заменой выделенного.
 * @param element - Textarea-элемент.
 * @param text - Вставляемый текст.
 * ***************************************************************************
 */
export function inputInsertText(element: HTMLTextAreaElement, text: string): void {

    // Сохраняем позицию курсора
    const startPos = element.selectionStart;
    const endPos = element.selectionEnd;

    // Заменяем выделенный текст (или вставляем в позицию курсора)
    element.value = element.value.substring(0, startPos) +
        text +
        element.value.substring(endPos);

    // Устанавливаем курсор после вставленного текста
    element.selectionStart = element.selectionEnd = startPos + text.length;
    element.focus();

}
