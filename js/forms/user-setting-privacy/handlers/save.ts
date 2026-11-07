// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { savePrivacySettingsRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettingPrivacy } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранение настроек конфиденциальности: закрытая форма при успехе, разбор
 * кодов ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function saveHandler(form: UserSettingPrivacy): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const calls = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="calls"]:checked`);
    const messages = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="messages"]:checked`);
    const messageVoice = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="messages-voice"]:checked`);
    const searchUsers = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="search-users"]:checked`);
    const sharingFiles = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="sharing-files"]:checked`);

    // Отмеченные радио обязаны быть в шаблоне — иначе сохранять нечего
    if (!calls || !messages || !messageVoice || !searchUsers || !sharingFiles) return;

    try {

        // Запрос
        const response = await savePrivacySettingsRequest({
            privacy_calls: calls.value,
            privacy_messages: messages.value,
            privacy_messages_voice: messageVoice.value,
            privacy_search_users: searchUsers.value,
            privacy_sharing_files: sharingFiles.value
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.user_setting_privacy.toasts.success_save"));

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Если ошибка приватности (PRIVACY_CALLS_INVALID, PRIVACY_MESSAGES_INVALID и т.д.)
        if (getErrorMessage(error).includes("PRIVACY_") && getErrorMessage(error).includes("_INVALID")) {

            // Toast
            Toast.error(t("forms.user_setting_privacy.toasts.privacy_invalid"));

        } else {

            // Прочая ошибка сервера
            Toast.error(t("api.errors.server_error"));
        }

    }

}
