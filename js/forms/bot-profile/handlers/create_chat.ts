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
import type { BotProfile } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание диалога с ботом: закрытый профиль, тост и открытый диалог
 * при успехе; разбор кодов ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function createChatHandler(form: BotProfile): Promise<void> {

    try {

        // Запрос
        const response = await createDialogRequest({ bot_id: form.botId });

        // Записываем id канала
        const channelId = response.data.channel_id;

        // Закрываем профиль
        form.modal?.close();

        // Toast
        Toast.success(t("forms.bot_profile.toasts.dialog_created"));

        // Открываем форму
        new Messages({ channelId: channelId });

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Нельзя создать чат с самим собой
        if (getErrorMessage(error).includes("ID_CANNOT_MATCH")) {

            // Toast
            Toast.error(t("forms.bot_profile.toasts.id_cannot_match"));
            isToastShown = true;
        }

        // Бот не найден
        if (getErrorMessage(error).includes("INVALID_BOT_ID")) {

            // Toast
            Toast.error(t("forms.bot_profile.toasts.invalid_bot_id"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
