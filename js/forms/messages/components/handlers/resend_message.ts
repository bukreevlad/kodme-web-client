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

        // Снимаем флаг ошибки у записи очереди
        const db = IndexedDB.db;
        const updated = db
            ? await db.table<MessageRecord, string>("pending_messages").update(message.data.id, { is_error_sending: false })
            : 0;

        // Если записи уже нет (пришло полное сообщение) — отправлять нечего
        if (updated > 0) {

            // Обновляем запись в Store и запускаем отправку
            message.form.store.update(message.data.id, { is_error_sending: false });
            sendingMessages(message.form);

        }

    } catch (error) {
        Logger.error(error);
    }

}
