// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { unbanMemberRequest } from "../requests/unban_member.js";

// Импортируем типы
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Разблокировка автора сообщения: запрос модерации и тост результата.
 * Диалог не показывается — действие обратимо.
 * @param message - Сообщение, автор которого разблокируется.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function unbanMemberHandler(message: MessageItem): Promise<void> {

    try {

        // Канал и автор есть у сообщения (пункт меню показывается только при них)
        const channel_id = message.data.channel_id;
        const user_id = message.data.created_user_id;
        if (!channel_id || !user_id) return;

        try {

            // Запрос модерации
            await unbanMemberRequest({ channel_id, user_id });

            // Обновляем состояние автора: пункт меню сменится на «Забанить»
            message.data.author_is_blocked = false;

            // Сообщение
            Toast.success(t("forms.messages.components.messages.toasts.unban_success"), { position: "bottom-center" });

        } catch (error) {
            toastError(error, { context: "[app][messages][moderation][unban]" });
        }

    } catch (error) {
        Logger.error(error);
    }

}
