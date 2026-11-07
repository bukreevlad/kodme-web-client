// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем requests
import { createDialogRequest } from "../requests/create_dialog.js";

// Импортируем типы
import type { UserProfile } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание диалога из профиля: закрывает профиль и открывает форму сообщений.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function createChatHandler(form: UserProfile): Promise<void> {

    try {

        // Запрос
        let response = await createDialogRequest({ user_id: form.userId });

        // Записываем id канала
        let channelId = response.data.channel_id;

        // Закрываем профиль
        form.modal?.close();

        // Toast
        Toast.success(t("forms.user_profile.toasts.dialog_created"));

        // Открываем форму
        let instance = Messages.instances.get(channelId);
        if (instance) {
            instance?.modal?.activate();
        } else {
            new Messages({ channelId: channelId });
        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Нельзя создать диалог с самим собой
        if (getErrorMessage(error).includes("IDS_CANNOT_MATCH")) {

            // Toast
            Toast.error(t("forms.user_profile.toasts.ids_cannot_match"));
            isToastShown = true;
        }

        // Пользователь не найден
        if (getErrorMessage(error).includes("USER_NOT_FOUND")) {

            // Toast
            Toast.error(t("forms.user_profile.toasts.user_not_found"));
            isToastShown = true;
        }

        // Нет доступа
        if (getErrorMessage(error).includes("ACCESS_DENIED")) {

            // Toast
            Toast.error(t("forms.user_profile.toasts.access_denied"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
