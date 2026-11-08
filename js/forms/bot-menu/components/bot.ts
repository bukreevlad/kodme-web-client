// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем типы
import type { BotMenuBot } from "../index.js";

/**
 * ***************************************************************************
 * Шаблон строки бота.
 *
 * Используем DOMParser для безопасного и чистого создания элемента без
 * innerHTML.
 * @returns DOM-элемент строки бота.
 * ***************************************************************************
 */
function template(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-2 p-1 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
            <div class="item flex flex-row self-center">
                <div class="cdm-avatar relative"></div>
            </div>
            <div class="item flex flex-col gap-0 justify-center" title="">
                <div data-link class="font-semibold text-lg"></div>
            </div>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка данных строки бота: аватар и публичная ссылка.
 * @param element - DOM-элемент строки.
 * @param data - Данные бота.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: BotMenuBot): void {

    try {

        // Устанавливаем элементы
        let avatar = element.querySelector<HTMLElement>(".cdm-avatar");

        // Аватар
        new Avatars({
            element: avatar,
            id: data.id,
            name: data.link,
        });

        // Имя
        let link = element.querySelector("[data-link]");
        if (link) link.textContent = data.link ?? null;

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Строка бота в списке ботов формы «Меню бота».
 * @param data - Данные бота.
 * @returns DOM-элемент строки бота для вставки в список.
 * ***************************************************************************
 */
export function createBotItem(data: BotMenuBot): HTMLElement {

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
