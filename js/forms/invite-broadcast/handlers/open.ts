// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { BroadcastPlay } from "../../broadcast-play/index.js";

// Импортируем requests
import { subscribeWithInviteRequest } from "../requests/subscribe_with_invite.js";

// Импортируем типы
import type { InviteBroadcast } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на трансляцию по приглашению и открытие её воспроизведения.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function openHandler(form: InviteBroadcast): Promise<void> {

    try {

        // Запрос
        await subscribeWithInviteRequest({
            cast_id: form.castId,
            invite: form.invite
        });

        // Toast
        Toast.success(window._lc.forms.invite_broadcast.toasts.success_subscribe);

        // Открываем форму
        new BroadcastPlay({ castId: form.castId });

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Срок действия приглашения истёк
        if (getErrorMessage(error).includes("INVITE_EXPIRED")) {

            // Toast
            Toast.error(window._lc.forms.invite_broadcast.toasts.invite_expired);
            isToastShown = true;
        }

        // Лимит использования приглашения исчерпан
        if (getErrorMessage(error).includes("INVITE_MAX_USES_EXCEEDED")) {

            // Toast
            Toast.error(window._lc.forms.invite_broadcast.toasts.invite_max_uses);
            isToastShown = true;
        }

        // Отсутствует приглашение
        if (getErrorMessage(error).includes("INVITE_REQUIRED")) {

            // Toast
            Toast.error(window._lc.forms.invite_broadcast.toasts.invite_required);
            isToastShown = true;
        }

        // Приглашение не подходит для этой трансляции
        if (getErrorMessage(error).includes("INVITE_ENTITY_MISMATCH")) {

            // Toast
            Toast.error(window._lc.forms.invite_broadcast.toasts.entity_mismatch);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
