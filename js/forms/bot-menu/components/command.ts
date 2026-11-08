// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BotMenuNode } from "../index.js";

/**
 * ***************************************************************************
 * Шаблон команды меню бота.
 *
 * Используем DOMParser для безопасного и чистого создания элемента без
 * innerHTML.
 * @returns DOM-элемент команды.
 * ***************************************************************************
 */
function template(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-col gap-0 p-1 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg items-start cursor-pointer" title="">
            <span data-command class="font-mono font-semibold text-sm"></span>
            <span data-name class="text-secondary text-xs"></span>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка данных команды: текст команды, название и описание в title.
 * @param element - DOM-элемент команды.
 * @param data - Данные команды.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: BotMenuNode): void {

    try {

        // Команда
        let command = element.querySelector("[data-command]");
        if (command) command.textContent = data.command ?? null;

        // Название
        let name = element.querySelector("[data-name]");
        if (name) name.textContent = data.name ?? null;

        // Описание
        // Описание — подсказка в title; без него атрибут не заполняем
        if (data.about !== undefined) {
            element.setAttribute("title", data.about);
        }

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Команда меню бота в форме «Меню бота».
 * @param data - Данные команды.
 * @returns DOM-элемент команды для вставки в меню.
 * ***************************************************************************
 */
export function createCommandItem(data: BotMenuNode): HTMLElement {

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
