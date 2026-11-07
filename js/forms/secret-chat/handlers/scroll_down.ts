// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { secretMessagesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем functions
import { firstLoadMessages } from "../functions/first_load_messages.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Кнопка «прокрутить вниз». Если последнее сообщение истории уже в окне —
 * просто скроллим вниз; если окно уезжало в старую историю (низ окна
 * обрезан) — пересобираем его вокруг хвоста чата.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после прокрутки.
 * ***************************************************************************
 */
export async function scrollDownHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Последнее сообщение локальной истории (без БД прыгать не по чему)
        const lastRecord = await secretMessagesTable()
            .where("chat_id")
            .equals(form.chatId)
            .reverse()
            .first();

        // Если последнего сообщения нет в окне — пересобираем окно вокруг хвоста
        if (lastRecord && !form.store.get(lastRecord.id)) {
            await firstLoadMessages(form);
        }

        // Прокручиваем в самый низ
        form.listScrollManager?.scrollToBottom("smooth");

    } catch (error) {
        Logger.error(error);
    }

}
