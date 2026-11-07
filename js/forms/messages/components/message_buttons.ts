// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Ипортируем handlers
import { messageButtonClickHandler } from "./handlers/message_button_click.js";

// Импортируем типы
import type { MessageButton, MessageData } from "./types.js";

/**
 * ***************************************************************************
 * messageButtons - сборка блока инлайн-кнопок сообщения: строки кнопок
 * от бота с фильтрацией присланных классов.
 * @param data - Данные сообщения.
 * @returns DOM-элемент блока кнопок (null, если кнопок нет).
 * ***************************************************************************
 */
export function messageButtons(data: MessageData): HTMLElement | null {

    try {

        // Ескли кнопок в сообщении нет
        if (!data?.buttons || data.buttons?.length === 0) return null;

        // Шаблон
        let tpl = templateWrap();
        tpl.innerHTML = "";

        // Проходим по строкам
        for (let row of data?.buttons) {
            if (Array.isArray(row)) {

                // Оборачиваем массив кнопок в div
                let rowElement = templateRow();

                // Проходим по кнопкам
                row.forEach(button => {

                    // Создать кнопку
                    let buttonElement = createButton(button, data);
                    rowElement.appendChild(buttonElement);

                    // Дополнительные классы от бота/сервера.
                    // Применяем только безопасные токены: сервер (а значит и любой бот)
                    // не должен ронять рендер сообщения строкой вида "classA classB"
                    // (classList.add бросает InvalidCharacterError) или подменять
                    // служебные стили компонента.
                    applyClasses(buttonElement, button?.classes);

                });

                // Добавляем в tpl
                tpl.appendChild(rowElement);

            }
        }

        return tpl;

    } catch (error) {
        Logger.error("[app][messages][buttons]:", error);
    }

    return null;

}

/**
 * ***************************************************************************
 * Применить дополнительные классы кнопки, пропуская небезопасные значения.
 *
 * Что отсекаем:
 * - строку целиком ("btn btn-primary") — classList.add умеет только один токен,
 *   пробел приводил к InvalidCharacterError и ронял блок кнопок;
 * - любые символы вне [-_a-zA-Z0-9/:.[\]%!] — защита от мусорных значений;
 * - служебные классы нашей системы (ui-*, cdm-*, is-*), чтобы бот не ломал
 *   поведение компонента.
 * @param element - Кнопка.
 * @param classes - Классы от сервера (массив либо строка).
 * @returns void
 * ***************************************************************************
 */
function applyClasses(element: Element, classes?: string[] | string): void {

    // Приводим к массиву: сервер мог прислать как массив, так и строку
    const tokens = Array.isArray(classes) ? classes : (typeof classes === "string" ? classes.split(/\s+/) : []);

    for (const token of tokens) {

        // Приводим к строке и обрезаем
        const className = String(token ?? "").trim();
        if (!className) continue;

        // Только «чистый» токен класса
        if (!/^[-_a-zA-Z0-9/:.[\]%!]{1,120}$/.test(className)) {
            Logger.warn("[app][messages][buttons]: отброшен некорректный класс:", className);
            continue;
        }

        // Служебные классы компонента не трогаем
        if (/^(ui-|cdm-|is-|group-)/.test(className)) {
            Logger.warn("[app][messages][buttons]: отброшен служебный класс:", className);
            continue;
        }

        // classList.add на валидном токене не бросит, но подстрахуемся
        try {
            element.classList.add(className);
        } catch (error) {
            Logger.error("[app][messages][buttons]: не удалось применить класс:", error);
        }

    }

}

/**
 * ***************************************************************************
 * Создать одну кнопку.
 * @param button - Данные кнопки.
 * @param data - Данные сообщения.
 * @returns DOM-элемент кнопки.
 * ***************************************************************************
 */
function createButton(button: MessageButton, data: MessageData): HTMLButtonElement {

    // Шаблон
    let element = templateButton();
    element.textContent = button.text ?? null;

    // Клик
    element.addEventListener("click", () => messageButtonClickHandler(element, button, data));

    return element;

}

/**
 * ***************************************************************************
 * Шаблон обёртки всех строк кнопок.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент обёртки.
 * ***************************************************************************
 */
function templateWrap(): HTMLElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
            <div class="buttons-wrap flex flex-col gap-1"></div>
        `, "text/html").querySelector<HTMLDivElement>(".buttons-wrap");

    // Своя разметка всегда содержит «.buttons-wrap» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .buttons-wrap");

    return element;

}

/**
 * ***************************************************************************
 * Шаблон строки кнопок.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент строки.
 * ***************************************************************************
 */
function templateRow(): HTMLElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
            <div class="button-group flex flex-row gap-1"></div>
        `, "text/html").querySelector<HTMLDivElement>(".button-group");

    // Своя разметка всегда содержит «.button-group» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .button-group");

    return element;

}

/**
 * ***************************************************************************
 * Шаблон кнопки (через общий компонент Buttons).
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент кнопки.
 * ***************************************************************************
 */
function templateButton(): HTMLButtonElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
            ${Buttons.create({
                classes: ["bg-white/80", "dark:bg-gray-700/80"]
            })}
        `, "text/html").querySelector<HTMLButtonElement>("button");

    // Своя разметка всегда содержит «button» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: button");

    return element;

}
