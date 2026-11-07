// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";
import { UserProfile } from "../../user-profile/index.js";
import { BotProfile } from "../../bot-profile/index.js";

// Импортируем типы
import type { MessageData } from "./types.js";
import type { MessageItem } from "./message.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * createForward - блок «Переслано» внутри тела сообщения.
 *
 * Если данные пересланного сообщения отсутствуют, в блоке показывается
 * заглушка «неизвестно» (так и было задумано), поэтому данные здесь
 * не приводятся к непустому виду.
 * @param message - Родительский компонент сообщения.
 * @returns DOM-элемент блока пересылки.
 * ***************************************************************************
 */
export function createForward(message: MessageItem): HTMLElement {

    // Записываем данные
    const data = message.data?.forwarded_message;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data);

    // Прикрепляем обработчики событий
    actions(element, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент блока пересылки.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML

    // invariant: корневой .forward-wrap входит в сам шаблон — querySelector
    // с текстовым HTML всегда находит его
    return new DOMParser().parseFromString(`
        <div class="forward-wrap flex flex-row gap-1 p-1 items-start w-full rounded-md cursor-pointer bg-[var(--color-brand)]/10 dark:bg-[var(--color-brand)]/10 border-l-3 border-[var(--color-brand)]">
            <span class="text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]">${t("forms.messages.components.messages.forward.forwarded_from")}</span>
            <span data-display-name class="font-semibold text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
        </div>
    `, "text/html").querySelector<HTMLDivElement>(".forward-wrap")!;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных блока.
 * @param element - DOM-элемент блока.
 * @param data - Данные пересланного сообщения (могут отсутствовать).
 * ***************************************************************************
 */
function setup(element: HTMLElement, data?: MessageData | null): void {

    try {

        // Получаем элемент заранее: он нужен и для ветки «нет данных»,
        // иначе обращение к нему до объявления падало по TDZ (ReferenceError)
        // и текст «неизвестно» никогда не отображался
        const displayName = element.querySelector(":scope >[data-display-name]");

        // Без узла подписи заполнять нечего
        if (!displayName) return;

        // Если данных пересланного сообщения нет
        if (!data) {
            displayName.textContent = t("forms.messages.components.messages.forward.unknown");
        } else {

            // Записываем данные (display_name опционален — нормализуем к null)
            displayName.textContent = data.display_name ?? null;

        }

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Обработчики блока: переход к источнику пересылки (канал/пользователь/бот).
 * @param element - DOM-элемент блока.
 * @param data - Данные пересланного сообщения (могут отсутствовать).
 * ***************************************************************************
 */
function actions(element: HTMLElement, data?: MessageData | null): void {

    // Перейти к сообщению
    element.addEventListener("click", () => {

        // Без данных пересланного сообщения переходить некуда
        if (!data) return;

        // Если сообщество
        if (data.channel_id) {
            let instance = Messages.instances.get(data.channel_id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new Messages({ channelId: data.channel_id });
            }
        }

        // Если пользователь
        if (data.user_id) {
            let instance = UserProfile.instances.get(data.user_id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new UserProfile({
                    userId: data.user_id,
                    options: {
                        insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle .form-container")
                    }
                });
            }
        }

        // Если бот
        if (data.bot_id) {
            let instance = BotProfile.instances.get(data.bot_id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new BotProfile({
                    botId: data.bot_id,
                    options: {
                        insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle .form-container")
                    }
                });
            }
        }

    });

}
