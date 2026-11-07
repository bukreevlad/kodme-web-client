// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем типы
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * removePendingMessageHandler - удаление сообщения, которое ещё отправляется
 * (pending): чистит IndexedDB и хранилище формы.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function removePendingMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Удаляем сообщение из IndexedDB
        await IndexedDB.db?.table<MessageRecord, string>("pending_messages").delete(message.data.id);

        // Удаляем сообщение из Messages.Store
        message.form.store.remove(message.data.id);

        // Toast
        Toast.success(t("forms.messages.components.messages.toasts.message_removed"), { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
