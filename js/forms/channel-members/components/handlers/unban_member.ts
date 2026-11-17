// Импортируем utils

import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { unbanMemberRequest } from "../../requests/unban_member.js";

// Импортируем типы
import type { ChannelMembers } from "../../index.js";
import type { MemberRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Разблокировка участника: запрос модерации и обновление строки в сторе.
 * Диалог не показывается — действие обратимо.
 * @param form - Форма участников.
 * @param member - Участник, которого разблокируют.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function unbanMemberHandler(form: ChannelMembers, member: MemberRecord): Promise<void> {

    try {

        // Запрос модерации
        await unbanMemberRequest({
            channel_id: form.channelId,
            user_id: member.user_id
        });

        // Сообщение
        Toast.success(t("forms.channel_members.toasts.unban_success"), { position: "bottom-center" });

        // Обновляем строку участника
        form.store.update(member.user_id, { is_banned: false });

    } catch (error) {
        toastError(error, { context: "[app][channel-members][unban]" });
    }

}
