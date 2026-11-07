// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Inputs } from "../../../components/inputs.js";

// Импортируем requests
import { setPasswordRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettingPassword } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Смена пароля пользователя: закрытая форма при успехе, разбор кодов ошибок
 * сервера при неудаче.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function saveHandler(form: UserSettingPassword): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const currentPassword = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="current-password"]`);
    const newPassword = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="new-password"]`);
    const retryPassword = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="retry-password"]`);
    const exitOtherDevices = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="exit-other-devices"]`);

    // Поля обязаны входить в шаблон — иначе сохранять нечего
    if (!currentPassword || !newPassword || !retryPassword || !exitOtherDevices) return;

    try {

        // Запрос
        const response = await setPasswordRequest({
            old_password: currentPassword.value,
            new_password: newPassword.value,
            retry_password: retryPassword.value,
            is_exit_other_sessions: exitOtherDevices.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.user_setting_password.toasts.success_set_password"));

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если не передан текущий пароль (поле подсвечивается, тост не нужен)
        if (getErrorMessage(error).includes("OLD_PASSWORD_REQUIRED")) {
            Inputs.markInvalid(currentPassword, true);
            isToastShown = true;
        }

        // Если текущий пароль не совпадает
        if (getErrorMessage(error).includes("OLD_PASSWORD_NOT_MATCH")) {
            Inputs.markInvalid(currentPassword, true);

            // Toast
            Toast.error(t("forms.user_setting_password.toasts.old_password_not_match"));
            isToastShown = true;
        }

        // Если не передан новый пароль
        if (getErrorMessage(error).includes("NEW_PASSWORD_REQUIRED")) {
            Inputs.markInvalid(newPassword, true);

            // Toast
            Toast.error(t("forms.user_setting_password.toasts.new_password_required"));
            isToastShown = true;
        }

        // Если новый пароль слишком короткий
        if (getErrorMessage(error).includes("NEW_PASSWORD_TOO_SHORT")) {
            Inputs.markInvalid(newPassword, true);

            // Toast
            Toast.error(t("forms.user_setting_password.toasts.new_password_too_short"));
            isToastShown = true;
        }

        // Если не передан повторный пароль
        if (getErrorMessage(error).includes("RETRY_PASSWORD_REQUIRED")) {
            Inputs.markInvalid(retryPassword, true);

            // Toast
            Toast.error(t("forms.user_setting_password.toasts.retry_password_required"));
            isToastShown = true;
        }

        // Если пароли не совпадают
        if (getErrorMessage(error).includes("PASSWORDS_NOT_MATCH")) {
            Inputs.markInvalid(newPassword, true);
            Inputs.markInvalid(retryPassword, true);

            // Toast
            Toast.error(t("forms.user_setting_password.toasts.passwords_not_match"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
