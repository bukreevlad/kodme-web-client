// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { CommentRecord } from "../types.js";

/**
 * ***************************************************************************
 * createFooterReplyComment - футер «Ответ на комментарий» над полем ввода:
 * показывает данные комментария-ответа и снимает ответ кнопкой крестика.
 * @param form - Экземпляр формы.
 * @param data - Данные комментария-ответа.
 * @returns DOM-элемент футера.
 * ***************************************************************************
 */
export function createFooterReplyComment(form: Comments, data: CommentRecord): HTMLElement {

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
            ${Icons.icon("arrow-back-up-double")?.outerHTML}
            <div class="flex flex-col gap-1 w-full overflow-hidden">
                <span data-display-name class="font-semibold text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
                <div class="flex flex-row gap-2">
                    <div data-media class="flex flex-row gap-1 empty:hidden"></div>
                    <span data-text class="truncate"></span>
                </div>
            </div>
            <button action-remove-reply class="rounded-full secondary">${Icons.icon("X")?.outerHTML}</button>
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
 * @param data - Данные комментария-ответа.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: CommentRecord): void {

    try {

        // Устанавливаем элементы
        const displayName = element.querySelector(":scope [data-display-name]");
        const text = element.querySelector(":scope [data-text]");
        const media = element.querySelector(":scope [data-media]");

        // Сборка превью вложений и подписи — общая функция из Messages
        // (сигнатура расширена структурным типом, формы не объединяются)
        attachmentStrip(data, { displayName, text, media });

    } catch (error) {
        Logger.error("[app][comments][footer-reply]:", error);
    }

}

/**
 * ***************************************************************************
 * Обработчики футера.
 * @param element - DOM-элемент футера.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: Comments): void {

    // Удалить ответ (режим редактирования при этом не трогаем)
    const remove = element.querySelector(":scope [action-remove-reply]");
    remove?.addEventListener("click", () => {
        element.remove();
        form.replyComment = null;
    });

}
