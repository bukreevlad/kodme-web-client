// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config формы
import { SECTION_IDS } from "../config/sections.js";

// Импортируем handlers
import { searchSectionHandler } from "./search_section.js";

// Импортируем типы
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Поиск по всем разрешённым категориям.
 *
 * Отличие от прежней реализации: искали только в активной вкладке
 * (`form.tabs.currentId`), остальные сохраняли неотфильтрованные данные первой
 * загрузки. Сценарий: ищем «иван» на вкладке «Сообщества» → переходим на
 * «Люди» → видим полный список, а не результаты.
 *
 * Категории запрашиваются параллельно и делят один номер поиска: неудача на
 * одной вкладке не отменяет остальные, а вот новый клик по «Поиск» отменяет
 * все ответы предыдущего разом (иначе старый ответ переписал бы новый).
 *
 * @param form - Экземпляр формы.
 * @returns Результат по каждой категории.
 ***************************************************************************
 */
export async function searchHandler(form: Search): Promise<boolean[]> {

    if (!form) return [];

    // Строка поиска: обрезаем один раз здесь, чтобы все вкладки искали
    // по одному и тому же значению
    const search = (form?.text?.value ?? "").trim();

    const ids = SECTION_IDS
        .filter(id => form.allowSearchType?.includes(id));

    if (!ids.length) return [];

    // Один номер на весь поиск, а не на категорию: см. комментарий в
    // searchSectionHandler про seq
    form.searchSeq = (form.searchSeq || 0) + 1;
    const seq = form.searchSeq;

    try {

        Logger.debug(`[app][search]: поиск №${seq} «${search}» по [${ids.join(", ")}]`);

        return await Promise.all(ids.map(id => searchSectionHandler(form, id, search, seq)));

    } catch (error) {

        // Ошибки отдельных категорий уже разобраны в searchSectionHandler: сюда
        // попадает только сбой самого запуска поиска
        Logger.error("[app][search][search]:", error);

        return [];

    }

}
