// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { MeetPlay } from "../../meet-play/index.js";

// Импортируем requests
import { subscribeWithInviteRequest } from "../requests/subscribe_with_invite.js";

// Импортируем типы
import type { InviteMeet } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подписка на конференцию по приглашению и открытие её воспроизведения.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function openHandler(form: InviteMeet): Promise<void> {

    try {

        // Запрос
        await subscribeWithInviteRequest({
            meet_id: form.meetId,
            invite: form.invite
        });

        // Toast
        Toast.success(t("forms.invite_meet.toasts.success_subscribe"));

        // Открываем форму
        new MeetPlay({ meetId: form.meetId });

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Срок действия приглашения истёк
        if (getErrorMessage(error).includes("INVITE_INVALID_EXPIRED")) {

            // Toast
            Toast.error(t("forms.invite_meet.toasts.invite_invalid_expired"));
            isToastShown = true;
        }

        // Лимит использования приглашения исчерпан
        if (getErrorMessage(error).includes("INVITE_INVALID_MAX_USES")) {

            // Toast
            Toast.error(t("forms.invite_meet.toasts.invite_invalid_max_uses"));
            isToastShown = true;
        }

        // Отсутствует приглашение
        if (getErrorMessage(error).includes("INVITE_REQUIRED")) {

            // Toast
            Toast.error(t("forms.invite_meet.toasts.invite_required"));
            isToastShown = true;
        }

        // Приглашение не подходит для этой конференции
        if (getErrorMessage(error).includes("INVITE_ENTITY_MISMATCH")) {

            // Toast
            Toast.error(t("forms.invite_meet.toasts.entity_mismatch"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
