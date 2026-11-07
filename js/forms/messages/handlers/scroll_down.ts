// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { loadLatestMessages } from "../functions/load_latest_messages.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Кнопка «прокрутить вниз». Если последнее сообщение уже в Store — просто
 * скроллим вниз; если ушли далеко в истории — прыгаем к хвосту канала.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после прокрутки.
 * ***************************************************************************
 */
export async function scrollDownHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Если последнего сообщения нет в окне — прыгаем к хвосту канала
        const lastMessage = form.store.get(form.channel?.last_message_id ?? "");
        if (!lastMessage) {
            await loadLatestMessages(form);
        }

        // Прокручиваем в самый низ
        form.listScrollManager?.scrollToBottom("smooth");

    } catch (error) {
        Logger.error(error);
    }

}
