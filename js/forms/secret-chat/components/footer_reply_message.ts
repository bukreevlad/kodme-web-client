// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { SessionProfile } from "../../menu/types.js";
import type { SecretChatMessageItem } from "./message.js";

/**
 * ***************************************************************************
 * createFooterReplyMessage - футер «Ответ на сообщение» над полем ввода:
 * показывает данные сообщения-ответа и снимает ответ кнопкой крестика.
 * @param message - Компонент сообщения-ответа.
 * @returns DOM-элемент футера.
 * ***************************************************************************
 */
export function createFooterReplyMessage(message: SecretChatMessageItem): HTMLElement {

    // Записываем данные
    const data = message.data;
    const form = message.form;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data, form);

    // Прикрепляем обработчики событий
    actions(element, form);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * @returns DOM-элемент футера.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Получаем параметр Blur из настроек пользователя
    const isBlur = LocalStorage?.session?.settings?.user?.decorations?.blur || false;

    // Мы используем DOMParser для создания DOM без innerHTML
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

    // Своя разметка всегда содержит «[data-reply]» — без элемента футер не создаётся
    if (!element) throw new Error("Не найден шаблон: [data-reply]");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных футера.
 * @param element - DOM-элемент футера.
 * @param data - Данные сообщения-ответа.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: SecretChatMessageItem["data"], form: SecretChatMessageItem["form"]): void {

    try {

        // Устанавливаем элементы
        let displayName = element.querySelector(":scope [data-display-name]");
        let text = element.querySelector(":scope [data-text]");
        let media = element.querySelector(":scope [data-media]");

        // Имя автора: своё сообщение — имя пользователя сессии, входящее — собеседник
        // invariant: user хранится как unknown на границе localStorage; читаем имя
        const sessionUser = LocalStorage.session?.user as SessionProfile | undefined;
        const dataWithName = {
            ...data,
            display_name: data.sender === "me" ? sessionUser?.display_name ?? "" : form.peerName
        };

        // Сборка превью вложений и подписи — единая функция
        attachmentStrip(dataWithName, { displayName, text, media });

    } catch (error) {
        Logger.error("[app][secret-chat][footer]:", error);
    }

}

/**
 * ***************************************************************************
 * Обработчики футера.
 * @param element - DOM-элемент футера.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: SecretChatMessageItem["form"]): void {

    // Удалить ответ
    let remove = element.querySelector(":scope [action-remove-reply]");
    remove?.addEventListener("click", () => {
        element.remove();
        form.replyMessage = null;
    });

}
