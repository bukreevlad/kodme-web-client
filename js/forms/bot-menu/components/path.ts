// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BotMenuNode, BotMenuTree } from "../index.js";

/**
 * ***************************************************************************
 * Шаблон пункта пути (хлебная крошка меню бота).
 *
 * Используем DOMParser для безопасного и чистого создания элемента без
 * innerHTML.
 * @returns DOM-элемент пункта пути.
 * ***************************************************************************
 */
function template(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-col gap-0 p-1 bg-[var(--second-bg)] rounded-lg cursor-pointer" title="">
            <span data-name class="text-secondary text-sm"></span>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка данных пункта пути: подпись категории (или корня «./Меню»).
 * @param element - DOM-элемент пункта.
 * @param data - Данные узла пути.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: BotMenuNode | BotMenuTree): void {

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
 * Пункт пути до текущей категории в форме «Меню бота».
 *
 * Легаси-класс возвращал из конструктора DOM-элемент вместо `this`
 * (класс-фабрика — красный флаг миграции), поэтому модуль переведён на
 * функцию-фабрику: наружу уходит готовый элемент, внутренняя логика живёт
 * в замыкании.
 * @param data - Узел пути: категория либо корень дерева меню.
 * @returns DOM-элемент пункта пути для вставки в список.
 * ***************************************************************************
 */
export function createPathItem(data: BotMenuNode | BotMenuTree): HTMLElement {

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
