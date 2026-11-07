// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { MessageItem } from "./message.js";

/**
 * ***************************************************************************
 * createFooterEditMessage - футер «Редактирование сообщения» над полем ввода:
 * показывает данные редактируемого сообщения и снимает режим кнопкой крестика.
 * @param message - Компонент редактируемого сообщения.
 * @returns DOM-элемент футера.
 * ***************************************************************************
 */
export function createFooterEditMessage(message: MessageItem): HTMLElement {

    // Записываем данные
    const data = message.data;
    const form = message.form;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data);

    // Прикрепляем обработчики событий
    actions(element, form);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент футера.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Получаем параметр Blur из настроек пользователя
    const isBlur = LocalStorage?.session?.settings?.user?.decorations?.blur || false;

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
        <div data-reply class="flex flex-row gap-3 p-2 items-start rounded-xl shadow-lg w-full ${isBlur ? "backdrop-blur-[20px] bg-[var(--form-bg)]/80" : "bg-[var(--form-bg)]"}">
            ${Icons.icon("pencil-minus")?.outerHTML}
            <div class="flex flex-col gap-1 w-full overflow-hidden">
                <span data-display-name class="font-semibold text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
                <div class="flex flex-row gap-2">
                    <div data-media class="flex flex-row gap-1 empty:hidden"></div>
                    <span data-text class="truncate"></span>
                </div>
            </div>
            <button action-remove-edit class="rounded-full secondary">${Icons.icon("X")?.outerHTML}</button>
        </div>
    `, "text/html").querySelector<HTMLDivElement>("[data-reply]");

    // Своя разметка всегда содержит «[data-reply]» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: [data-reply]");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных футера.
 * @param element - DOM-элемент футера.
 * @param data - Данные редактируемого сообщения.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: MessageItem["data"]): void {

    try {

        // Устанавливаем элементы
        let displayName = element.querySelector(":scope [data-display-name]");
        let text = element.querySelector(":scope [data-text]");
        let media = element.querySelector(":scope [data-media]");

        // Сборка превью вложений и подписи — единая функция
        attachmentStrip(data, { displayName, text, media }, { localeScope: "reply_footer" });

    } catch (error) {
        Logger.error("[app][messages][footer-edit]:", error);
    }

}

/**
 * ***************************************************************************
 * Обработчики футера.
 * @param element - DOM-элемент футера.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: MessageItem["form"]): void {

    // Удалить ответ
    let remove = element.querySelector(":scope [action-remove-edit]");
    remove?.addEventListener("click", () => {
        element.remove();
        form.editedMessage = null;
        resetTextarea(form);
        updateStateButtons(form);
    });

}
