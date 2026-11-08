// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Buttons } from "../../../../components/buttons.js";

// Импортируем handlers
import { editHandler } from "./handlers/edit.js";
import { removeHandler } from "./handlers/remove.js";

// Импортируем forms
import { BotApp } from "../../../bot-app/index.js";

// Импортируем типы
import type { BotAppRecord } from "../../types.js";
import type { BotSettings } from "../../index.js";

/**
 * ***************************************************************************
 * Шаблон строки приложения бота.
 *
 * Используем DOMParser для безопасного и чистого создания элемента без
 * innerHTML.
 * @returns DOM-элемент приложения.
 * ***************************************************************************
 */
function template(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-1 w-full p-1 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg justify-between items-center cursor-pointer">
            <div class="flex flex-col gap-0">
                <div class="flex flex-row gap-2 items-center">
                    <div class="shrink-0">${Icons.icon("app-window")?.outerHTML}</div>
                    <span data-name class="truncate w-full"></span>
                </div>
                <span data-url class="text-sm text-secondary w-full"></span>
            </div>
            <div class="flex flex-row gap-1">
                ${Buttons.transparent({ shape: "circle", attributes: ["action-edit"], icon: "pencil-minus" })}
                ${Buttons.transparent({ shape: "circle", attributes: ["action-remove"], icon: "trash" })}
            </div>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка данных приложения: название и URL.
 * @param element - DOM-элемент приложения.
 * @param data - Данные приложения.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: BotAppRecord): void {

    try {

        // Название
        let name = element.querySelector("[data-name]");
        if (name) name.textContent = data.name;

        // URL
        let url = element.querySelector("[data-url]");
        if (url) url.textContent = data.url;

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Обработчики строки приложения: открытие приложения, редактирование
 * и удаление.
 * @param element - DOM-элемент приложения.
 * @param form - Экземпляр формы.
 * @param data - Данные приложения.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: BotSettings, data: BotAppRecord): void {

    // Открываем app: BotApp читает только appId
    element.addEventListener("click", () => new BotApp({ appId: data.id }));

    // Изменить
    element.querySelector("[action-edit]")
        ?.addEventListener("click", (event) => editHandler(event, form, data));

    // Удалить
    element.querySelector("[action-remove]")
        ?.addEventListener("click", (event) => removeHandler(event, form, data));

}

/**
 * ***************************************************************************
 * Строка приложения бота в списке формы настроек.
 *
 * @param form - Экземпляр формы.
 * @param data - Данные приложения.
 * @returns DOM-элемент приложения для вставки в список.
 * ***************************************************************************
 */
export function createApplicationItem(form: BotSettings, data: BotAppRecord): HTMLElement {

    // Создаем DOM-элемент из шаблона
    let element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(element, data);

    // Прикрепляем обработчики событий
    actions(element, form, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
