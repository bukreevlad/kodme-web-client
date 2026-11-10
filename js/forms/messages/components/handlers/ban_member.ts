// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { ConfirmModerationDialog } from "../../dialogs/confirm_moderation/index.js";

// Импортируем requests
import { banMemberRequest } from "../requests/ban_member.js";

// Импортируем типы
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Блокировка участника: коды отказов сервера, которые получают свой тост.
 */
const BAN_REFUSED_CODES = ["CANNOT_BAN_SELF", "CANNOT_BAN_CREATOR", "CANNOT_BAN_MODERATOR"];

/**
 * ***************************************************************************
 * Блокировка автора сообщения: диалог подтверждения, запрос модерации
 * и тост результата.
 * @param message - Сообщение, автор которого блокируется.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function banMemberHandler(message: MessageItem): Promise<void> {

    try {

        // Канал и автор есть у сообщения (пункт меню показывается только при них)
        const channel_id = message.data.channel_id;
        const user_id = message.data.created_user_id;
        if (!channel_id || !user_id) return;

        // Диалог подтверждения (подписи берёт сам)
        new ConfirmModerationDialog({
            scenario: "ban",
            callback: async (confirmed) => {

                // Отмена — выходим
                if (!confirmed) return;

                try {

                    // Запрос модерации
                    await banMemberRequest({ channel_id, user_id });

                    // Обновляем состояние автора: пункт меню сменится на «Разблокировать»
                    message.data.author_is_blocked = true;

                    // Сообщение
                    Toast.success(t("forms.messages.components.messages.toasts.ban_success"), { position: "bottom-center" });

                } catch (error) {
                    toastError(error, {
                        context: "[app][messages][moderation][ban]",
                        codes: BAN_REFUSED_CODES,
                        text: t("forms.messages.components.messages.toasts.cannot_ban"),
                        fallback: t("api.errors.server_error")
                    });
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
