// Импортируем utils
import { toastError } from "../../../../utils/ui/toast_error.js";

// Загружаем requests
import { messageButtonClickRequest } from "../requests/message_button_click.js";

// Импортируем типы
import type { MessageButton, MessageData } from "../types.js";

/**
 * ***************************************************************************
 * messageButtonClickHandler - нажатие инлайн-кнопки бота: отправляет запрос
 * и показывает причину отказа (например, бот офлайн).
 * @param element - DOM элемент кнопки.
 * @param button - Данные кнопки.
 * @param data - Данные сообщения.
 * ***************************************************************************
 */
export async function messageButtonClickHandler(element: Element, button: MessageButton, data: MessageData): Promise<void> {

    // Действие привязано к каналу: без id запрос бессмысленен
    if (data.channel_id === undefined) return;

    try {

        // Добавляем класс
        element.classList.add("loading");

        // Запрос
        await messageButtonClickRequest({
            channel_id: data.channel_id,
            message_id: data.id,
            button_id: button.id,
            state: button.state,
            bot_id: data.created_user_id
        });

    } catch (error) {

        // Бот офлайн — сервер отдаёт код BOT_NOT_IN_NETWORK.
        // Раньше проверялась подстрока «Бот не в сети», которой на сервере нет,
        // и пользователь не видел причину отказа вообще.
        toastError(error, {
            context: "[app][messages][button-click]",
            codes: ["BOT_NOT_IN_NETWORK"],
            text: window._lc.forms.messages.toasts.bot_not_online
        });

    } finally {
        element.classList.remove("loading");
    }

}
