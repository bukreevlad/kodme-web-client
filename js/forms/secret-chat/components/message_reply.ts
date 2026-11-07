// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { SecretChatMessageData } from "./types.js";
import type { SecretChatMessageItem } from "./message.js";

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
export function createReply(message: SecretChatMessageItem): HTMLElement {

    // invariant: блок ответа создаётся только при наличии reply_to_message
    const data = message.data.reply_to_message as SecretChatMessageData;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data, message.form.peerName);

    // Прикрепляем обработчики событий
    actions(element, message.form, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * @returns DOM-элемент блока ответа.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Мы используем DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
        <div class="reply-wrap flex flex-col gap-0 p-1 items-start w-full rounded-md cursor-pointer bg-[var(--color-brand)]/10 border-l-3 border-[var(--color-brand)]">
            <span data-display-name class="font-semibold text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
            <div class="flex flex-col gap-0 w-full overflow-hidden">
                <div data-media class="flex flex-row gap-1 empty:hidden overflow-hidden"></div>
                <span data-text class="truncate text-sm"></span>
            </div>
        </div>
    `, "text/html").querySelector<HTMLDivElement>(".reply-wrap");

    // Своя разметка всегда содержит «.reply-wrap» — без элемента блок не создаётся
    if (!element) throw new Error("Не найден шаблон: .reply-wrap");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных блока.
 * @param element - DOM-элемент блока.
 * @param data - Данные сообщения-ответа.
 * @param peerName - Имя собеседника (для входящих сообщений-ответов).
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: SecretChatMessageData, peerName: string): void {

    try {

        // Устанавливаем элементы
        let displayName = element.querySelector(":scope >[data-display-name]");
        let text = element.querySelector(":scope [data-text]");
        let media = element.querySelector(":scope [data-media]");

        // Имя автора цитаты: входящее — собеседник, своё — пусто (как в messages)
        const dataWithName = { ...data, display_name: data.sender === "peer" ? peerName : "" };

        // Сборка превью вложений и подписи — единая функция
        attachmentStrip(dataWithName, { displayName, text, media });

    } catch (error) {
        Logger.error("[app][secret-chat][reply]:", error);
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
function actions(element: HTMLElement, form: SecretChatMessageItem["form"], data: SecretChatMessageData): void {

    // Подсветить сообщение-оригинал, если оно в окне
    element.addEventListener("click", (event) => {

        // Тап по цитате не должен дёргать контекстное меню/жесты строки
        event.stopPropagation();

        // Ищем DOM-копии оригинала в окне чата
        const domElements = form.store.get(data.id)?.__domElements__;
        if (!domElements?.length) return;

        // Подсвечиваем все копии и скроллим к первой
        domElements.forEach(el => {
            el.classList.remove("backlight");
            // Пере-запуск анимации подсветки требует пересборки кадра
            void el.offsetWidth;
            el.classList.add("backlight");
        });

        domElements[0]?.scrollIntoView({ behavior: "smooth", block: "center" });

    });

}
