// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { RemoveMessage } from "../dialogs/remove-message/index.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { SecretChatMessageItem } from "../message.js";

/**
 * ***************************************************************************
 * removeMessageHandler - удаление сообщения: диалог подтверждения и удаление
 * у обоих участников (control-кадр msg_remove зеркалит удаление на устройстве
 * собеседника). Чекбокса «для себя» нет — в секретном чате удаление всегда
 * двустороннее.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function removeMessageHandler(message: SecretChatMessageItem): Promise<void> {

    try {

        // Если не передано сообщение
        if (!message) return;

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Отображаем диалог
        new RemoveMessage({
            chatId: message.data?.chat_id,
            callback: async () => {

                try {

                    // Удаление локально + control-кадр собеседнику
                    await manager.removeMessage(message.data.chat_id ?? "", message.data.id);

                    // Сообщение
                    Toast.success(window._lc.forms.secret_chat.toasts.message_removed, { position: "bottom-center" });

                } catch (error) {

                    // Пользователь должен понимать, что произошло
                    toastError(error, { context: "[app][secret-chat][remove-message]" });

                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
