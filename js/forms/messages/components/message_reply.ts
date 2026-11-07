// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { goPointMessageHistory } from "../functions/go_point_message_hystory.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { MessageHost } from "./types.js";
import type { MessageData } from "./types.js";
import type { MessageItem } from "./message.js";

/**
 * ***************************************************************************
 * createReply - блок «Ответ на сообщение» внутри тела сообщения.
 *
 * Возвращает готовый элемент для вставки в DOM (фабрика вместо класса:
 * экземпляр нигде не хранится, публичных методов у блока нет).
 * @param message - Родительский компонент сообщения.
 * @returns DOM-элемент блока ответа.
 * ***************************************************************************
 */
export function createReply(message: MessageItem): HTMLElement {

    // invariant: блок ответа создаётся только при наличии reply_to_message
    const data = message.data.reply_to_message as MessageData;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data);

    // Прикрепляем обработчики событий
    actions(element, message.form, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент блока ответа.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
        <div class="reply-wrap flex flex-col gap-0 p-1 items-start w-full rounded-md cursor-pointer bg-[var(--color-brand)]/10 border-l-3 border-[var(--color-brand)]">
            <span data-display-name class="font-semibold text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
            <div class="flex flex-col gap-0 w-full overflow-hidden">
                <div data-media class="flex flex-row gap-1 empty:hidden overflow-hidden"></div>
                <span data-text class="truncate text-sm"></span>
            </div>
        </div>
    `, "text/html").querySelector<HTMLDivElement>(".reply-wrap");

    // Своя разметка всегда содержит «.reply-wrap» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .reply-wrap");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных блока.
 * @param element - DOM-элемент блока.
 * @param data - Данные сообщения-ответа.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: MessageData): void {

    try {

        // Устанавливаем элементы
        let displayName = element.querySelector(":scope >[data-display-name]");
        let text = element.querySelector(":scope [data-text]");
        let media = element.querySelector(":scope [data-media]");

        // Сборка превью вложений и подписи — единая функция
        attachmentStrip(data, { displayName, text, media }, { localeScope: "reply" });

    } catch (error) {
        Logger.error("[app][messages][reply]:", error);
    }

}

/**
 * ***************************************************************************
 * Обработчики блока.
 * @param element - DOM-элемент блока.
 * @param form - Экземпляр формы.
 * @param data - Данные сообщения-ответа.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: MessageHost["form"], data: MessageData): void {

    // Перейти к сообщению
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        goPointMessageHistory({ form, data, element });
    });

}
