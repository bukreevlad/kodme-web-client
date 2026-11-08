// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем типы
import type { BotMenuNode } from "../types.js";

/**
 * ***************************************************************************
 * Шаблон папки (категории) меню бота.
 *
 * Используем DOMParser для безопасного и чистого создания элемента без
 * innerHTML.
 * @returns DOM-элемент папки.
 * ***************************************************************************
 */
function template(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-2 p-1 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg justify-between items-center cursor-pointer">
            <div class="flex flex-row gap-2">
                ${Icons.icon("Folder")?.outerHTML}
                <span data-name class=""></span>
            </div>
            <button action-edit class="rounded-full">${Icons.icon("Pencil")?.outerHTML}</button>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка данных папки: название категории.
 * @param element - DOM-элемент папки.
 * @param data - Данные категории.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: BotMenuNode): void {

    try {

        // Название
        let name = element.querySelector("[data-name]");
        if (name) name.textContent = data.name ?? null;

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Папка (категория) меню бота в форме настроек бота.
 *
 * @param data - Данные категории.
 * @returns DOM-элемент папки для вставки в меню.
 * ***************************************************************************
 */
export function createCategoryItem(data: BotMenuNode): HTMLElement {

    // Создаем DOM-элемент из шаблона
    let element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(element, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
