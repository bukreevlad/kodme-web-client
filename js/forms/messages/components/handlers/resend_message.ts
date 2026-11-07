// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем functions
import { sendingMessages } from "../../functions/sending_messages.js";

// Импортируем типы
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * resendMessageHandler - повторная отправка несуществующего сообщения:
 * сбрасывает флаг ошибки и запускает очередь отправки.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function resendMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Удаляем сообщение из IndexedDB
        let pendingMessage = await IndexedDB.db?.table<MessageRecord, string>("pending_messages").get(message.data.id);
        if (pendingMessage) {

            // Оменяем флаг ошибки и обновляем
            pendingMessage.is_error_sending = false;
            await IndexedDB.db?.table<MessageRecord, string>("pending_messages").put(pendingMessage);

            // Удаляем сообщение из Messages.Store
            message.form.store.update(pendingMessage.id, pendingMessage);

            // Начинаем отправку
            sendingMessages(message.form);

        }

    } catch (error) {
        Logger.error(error);
    }

}
