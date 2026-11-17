// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { ConfirmModerationDialog } from "../../dialogs/confirm_moderation/index.js";

// Импортируем requests
import { banMemberRequest } from "../../requests/ban_member.js";

// Импортируем типы
import type { ChannelMembers } from "../../index.js";
import type { MemberRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Блокировка участника: диалог подтверждения, запрос модерации и
 * обновление строки в сторе (пункт меню сменится на «Разблокировать»).
 * @param form - Форма участников.
 * @param member - Участник, которого блокируют.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function banMemberHandler(form: ChannelMembers, member: MemberRecord): Promise<void> {

    try {

        // Диалог подтверждения (подписи берёт сам)
        new ConfirmModerationDialog({
            scenario: "ban",
            insertInto: form.modal?.content,
            callback: async (confirmed) => {

                // Отмена — выходим
                if (!confirmed) return;

                try {

                    // Запрос модерации
                    await banMemberRequest({
                        channel_id: form.channelId,
                        user_id: member.user_id
                    });

                    // Сообщение
                    Toast.success(t("forms.channel_members.toasts.ban_success"), { position: "bottom-center" });

                    // Обновляем строку участника
                    form.store.update(member.user_id, { is_banned: true });

                } catch (error) {
                    toastError(error, {
                        context: "[app][channel-members][ban]",
                        codes: ["CANNOT_BAN_SELF", "CANNOT_BAN_CREATOR", "CANNOT_BAN_MODERATOR"],
                        text: t("forms.channel_members.toasts.cannot_ban"),
                        fallback: t("api.errors.server_error")
                    });
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
