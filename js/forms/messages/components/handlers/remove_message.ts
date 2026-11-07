// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем functions
import { getSessionUserId } from "../../../main/functions/session_identity.js";

// Импортируем dialogs
import { RemoveMessage } from "../dialogs/remove-message/index.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { removeMessageRequest } from "../requests/remove_message.js";

// Импортируем типы
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * removeMessageHandler - удаление сообщения: открывает диалог подтверждения
 * (с чекбоксом «для всех», где он уместен) и выполняет удаление.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function removeMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Если не передан канал
        if (!message) return;

        // Устанавливаем параметры
        const sessionUserId = getSessionUserId();
        const channelType = message.data.channel_type;

        // Чаты с выбором «удалить только у себя / для всех»: личные диалоги,
        // диалоги с ботом, группы, темы, чаты конференций и трансляций.
        // В сообществах (тип 3) и избранном (тип 5) выбора нет — удаление
        // всегда «для всех»
        const isChat = [1, 2, 4, 6, 7, 8].includes(channelType ?? -1);

        // Имеет ли право удалять "Для всех" (правила доступа сервера)
        const canDeleteForAllInChat =
            [1, 8].includes(channelType ?? -1) ||
            message.data.created_user_id === sessionUserId ||
            message.form.channel?.created_user_id === sessionUserId ||
            (message.form.channel?.is_moderator && message.form.channel?.can_deleted_message);

        // Показывать ли чекбокс "Удалить для всех"
        const showForAllCheckbox = isChat && canDeleteForAllInChat;

        // Отображаем диалог
        new RemoveMessage({
            channelId: message.data?.channel_id,
            forAllCheckbox: showForAllCheckbox, // Покажется в личках, группах, темах и чатах конференций/трансляций
            callback: async (data) => {
                if (!data) return;

                // В чатах берем значение из чекбокса, где выбора нет
                // (сообщество и т.п.) — всегда для всех
                const shouldRemoveForAll = isChat ? !!data.for_all : true;

                // Запрос к API
                await removeMessageRequest({
                    message_id: message.data.id,
                    for_all: shouldRemoveForAll
                });

                // Локальное удаление
                await IndexedDB.db?.table<MessageRecord, string>("messages").delete(message.data.id);
                message.form.store.remove(message.data.id);

                // Сообщение
                Toast.success(window._lc.forms.messages.components.messages.toasts.message_removed, { position: "bottom-center" });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
