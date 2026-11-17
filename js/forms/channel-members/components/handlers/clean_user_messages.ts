// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { ConfirmModerationDialog } from "../../dialogs/confirm_moderation/index.js";

// Импортируем requests
import { cleanUserMessagesRequest } from "../../requests/clean_user_messages.js";

// Импортируем типы
import type { ChannelMembers } from "../../index.js";
import type { MemberRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление всех сообщений участника: диалог подтверждения и запрос
 * модерации. Сообщения уходят из открытого чата событием
 * [moderation]: cleaned — здесь только тост результата.
 * @param form - Форма участников.
 * @param member - Участник, чьи сообщения удаляются.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function cleanUserMessagesHandler(form: ChannelMembers, member: MemberRecord): Promise<void> {

    try {

        // Диалог подтверждения (подписи берёт сам)
        new ConfirmModerationDialog({
            scenario: "clean",
            insertInto: form.modal?.content,
            callback: async (confirmed) => {

                // Отмена — выходим
                if (!confirmed) return;

                try {

                    // Запрос модерации
                    await cleanUserMessagesRequest({
                        channel_id: form.channelId,
                        user_id: member.user_id
                    });

                    // Сообщение
                    Toast.success(t("forms.channel_members.toasts.clean_success"), { position: "bottom-center" });

                } catch (error) {
                    toastError(error, {
                        context: "[app][channel-members][clean]",
                        codes: ["CANNOT_CLEAN_SELF", "CANNOT_CLEAN_CREATOR", "CANNOT_CLEAN_MODERATOR"],
                        text: t("forms.channel_members.toasts.cannot_clean"),
                        fallback: t("api.errors.server_error")
                    });
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
