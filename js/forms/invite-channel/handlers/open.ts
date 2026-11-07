// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем requests
import { subscribeWithInviteRequest } from "../requests/subscribe_with_invite.js";

// Импортируем типы
import type { InviteChannel } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подписка на канал по приглашению и открытие переписки с ним.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function openHandler(form: InviteChannel): Promise<void> {

    try {

        // Запрос
        await subscribeWithInviteRequest({
            channel_id: form.invite.channel_id,
            invite: form.invite.invite
        });

        // Toast
        Toast.success(t("forms.invite_channel.toasts.success_subscribe"));

        // Открываем форму
        new Messages({ channelId: form.invite.channel_id });

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Срок действия приглашения истёк
        if (getErrorMessage(error).includes("INVITE_EXPIRED")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.invite_expired"));
            isToastShown = true;
        }

        // Лимит использования приглашения исчерпан
        if (getErrorMessage(error).includes("INVITE_MAX_USES_EXCEEDED")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.invite_max_uses"));
            isToastShown = true;
        }

        // Отсутствует приглашение
        if (getErrorMessage(error).includes("INVITE_REQUIRED")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.invite_required"));
            isToastShown = true;
        }

        // Канал не найден
        if (getErrorMessage(error).includes("CHANNEL_NOT_FOUND")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.channel_not_found"));
            isToastShown = true;
        }

        // Приглашение не подходит для этого канала
        if (getErrorMessage(error).includes("INVITE_ENTITY_MISMATCH")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.entity_mismatch"));
            isToastShown = true;
        }

        // Пользователь не найден
        if (getErrorMessage(error).includes("USER_NOT_FOUND")) {

            // Toast
            Toast.error(t("forms.invite_channel.toasts.user_not_found"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
