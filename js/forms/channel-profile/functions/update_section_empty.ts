// Импортируем типы
import type { ChannelProfile, MediaSection } from "../types.js";

/**
 * ***************************************************************************
 * Переключение пустого состояния секции вкладки.
 *
 * Пустоту показываем только после первой загрузки секции: пока идёт первый
 * запрос, непонятно — «записей нет» или «ещё не загрузилось». Ошибка первого
 * запроса ≠ пустая секция: isFirstLoaded в этом случае остаётся false.
 *
 * Пустое состояние живёт рядом со списком в панели вкладки (см.
 * functions/build_sections.ts → templatePane), поэтому сам список при
 * пустоте скрывать не нужно: он схлопнется сам.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @returns void
 * ***************************************************************************
 */
export function updateSectionEmpty(form: ChannelProfile, section: MediaSection): void {

    if (!form || !section) return;

    // Определяем пустоту: первая страница загружена и записей нет
    const isEmpty = form[`${section.id}FirstLoaded`] === true && form[section.storeKey]?.size === 0;

    // Переключаем блок пустого состояния секции (ключ состояния — от
    // section.id, поэтому читаем через индекс формы и проверяем типом)
    const empty: unknown = form[`${section.id}Empty`];
    if (empty instanceof HTMLElement) {
        empty.classList.toggle("hidden", !isEmpty);
    }

}
