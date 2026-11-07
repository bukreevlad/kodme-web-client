// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем dialogs
import { ForwardMessages } from "../../../forward-messages/index.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { forwardMessageRequest } from "../requests/forward_message.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * forwardMessageHandler - пересылка сообщения: открывает форму выбора каналов
 * и отправляет запрос после подтверждения.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function forwardMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Если не передан канал
        if (!message) return;

        // Отображаем форму
        new ForwardMessages({
            callback: async (data) => {
                if (!data) return;

                // Запрос к API
                await forwardMessageRequest({
                    message_id: message.data.id,
                    channel_ids: data
                });

                // Сообщение
                Toast.success(window._lc.forms.messages.components.messages.toasts.message_forwarded, { position: "bottom-center" });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
