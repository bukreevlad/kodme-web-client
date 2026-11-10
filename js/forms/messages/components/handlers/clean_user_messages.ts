// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { ConfirmModerationDialog } from "../../dialogs/confirm_moderation/index.js";

// Импортируем requests
import { cleanUserMessagesRequest } from "../requests/clean_user_messages.js";

// Импортируем типы
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление всех сообщений автора сообщения: диалог подтверждения,
 * запрос модерации и тост результата.
 * @param message - Сообщение, автор которого чистится.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function cleanUserMessagesHandler(message: MessageItem): Promise<void> {

    try {

        // Канал и автор есть у сообщения (пункт меню показывается только при них)
        const channel_id = message.data.channel_id;
        const user_id = message.data.created_user_id;
        if (!channel_id || !user_id) return;

        // Диалог подтверждения (подписи берёт сам)
        new ConfirmModerationDialog({
            scenario: "clean",
            callback: async (confirmed) => {

                // Отмена — выходим
                if (!confirmed) return;

                try {

                    // Запрос модерации
                    await cleanUserMessagesRequest({ channel_id, user_id });

                    // Сообщение: сообщения автора уходят через событие
                    // [moderation]: cleaned, здесь только результат действия
                    Toast.success(t("forms.messages.components.messages.toasts.clean_success"), { position: "bottom-center" });

                } catch (error) {
                    toastError(error, { context: "[app][messages][moderation][clean]" });
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
