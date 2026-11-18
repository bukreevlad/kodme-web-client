// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем functions
import { stripLocalAttaches } from "../../functions/import_attaches.js";

// Импортируем типы
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * removePendingMessageHandler - удаление сообщения, которое ещё отправляется
 * (pending): чистит IndexedDB и хранилище формы.
 *
 * Задача редактирования (is_edit) отменяется иначе: строка сообщения остаётся
 * в ленте — снимаются только флаги очереди и неприкреплённые локальные файлы.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function removePendingMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Очередь грузит это сообщение прямо сейчас — прерываем загрузку и
        // отправку, иначе файлы долетят в фоне и сообщение «воскреснет»
        const current = message.form.messageAbort;
        if (current && current.id === message.data.id) {
            current.controller.abort();
        }

        // Читаем запись ДО удаления: отмена задачи редактирования
        // не должна удалять само сообщение
        const pendingRow = await IndexedDB.db
            ?.table<MessageRecord, string>("pending_messages").get(message.data.id);

        // Удаляем сообщение из IndexedDB
        await IndexedDB.db?.table<MessageRecord, string>("pending_messages").delete(message.data.id);

        // Задача редактирования: сообщение остаётся в ленте
        if (pendingRow?.is_edit) {

            // Снимаем флаги очереди
            message.form.store.update(message.data.id, { is_pending: false, is_error_sending: false });

            // Неприкреплённые локальные файлы (не долетели) убираем из строки
            stripLocalAttaches(message.form, message.data.id);

        } else {

            // Удаляем сообщение из Messages.Store
            message.form.store.remove(message.data.id);

        }

        // Toast
        Toast.success(t("forms.messages.components.messages.toasts.message_removed"), { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
