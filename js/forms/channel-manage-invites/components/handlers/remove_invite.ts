// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { removeInviteRequest } from "../../requests/remove_invite.js";

// Импортируем dialogs
import { ConfirmInviteDialog } from "../../dialogs/confirm/index.js";

// Импортируем типы
import type { ChannelManageInvites } from "../../index.js";
import type { ChannelInvite } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отзыв приглашения канала через диалог подтверждения.
 * @param form - Экземпляр формы.
 * @param data - Данные приглашения строки списка.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function removeInviteHandler(form: ChannelManageInvites, data: ChannelInvite): Promise<void> {

    try {

        // Диалог подтверждения отзыва приглашения (подписи берёт сам)
        let dialogConfirm = new ConfirmInviteDialog({
            insertInto: form.modal?.content,
            callback: async (response) => {

                try {

                    // Если пользователь отказался — ничего не делаем
                    if (!response) return;

                    // Отзываем приглашение
                    let result = await removeInviteRequest({
                        channel_id: form.channelId,
                        invite_id: data.id
                    });

                    // Проверка запроса
                    if (result.status) {

                        // Закрываем диалог
                        dialogConfirm?.modal?.close();

                        // Toast
                        Toast.success(t("forms.channel_manage_invites.toasts.success_revoke"));

                        // Удаляем элемент из Store формы
                        form.store.remove(data.id);

                    }

                } catch (error) {
                    Logger.error(error);

                    // Флаг, что тост уже показан
                    let isToastShown = false;
                    let message = getErrorMessage(error);

                    // Приглашение уже отозвано — убираем строку из списка
                    if (message.includes("INVITE_NOT_FOUND")) {
                        Toast.error(t("forms.channel_manage_invites.toasts.revoke_not_found"));
                        form.store.remove(data.id);
                        isToastShown = true;
                    }

                    // Нет прав на отзыв
                    if (message.includes("ACCESS_DENIED")) {
                        Toast.error(t("api.errors.access_denied"));
                        isToastShown = true;
                    }

                    // Прочая ошибка сервера
                    if (!isToastShown) {
                        Toast.error(t("api.errors.server_error"));
                    }

                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
