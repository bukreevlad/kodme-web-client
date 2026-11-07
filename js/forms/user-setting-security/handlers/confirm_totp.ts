// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { totpConfirmRequest } from "../requests/totp_confirm.js";

// Импортируем functions
import { refreshTotpStatus } from "../functions/refresh_totp_status.js";

// Импортируем dialogs
import { TotpSetupDialog } from "../../user-totp-setup/index.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подтверждение включения TOTP вводом первого кода из приложения-генератора.
 * @param form - Форма безопасности.
 * @param code - Код из приложения-генератора.
 * ***************************************************************************
 */
export async function confirmTotpHandler(form: UserSettingSecurity, code: string): Promise<void> {

    try {

        // Пустой код — вводить нечего
        if (!code) {
            Toast.error(t("forms.user_setting_security.toasts.code_required"));
            return;
        }

        // Запрос подтверждения
        const response = await totpConfirmRequest({ code: code });

        // Проверка запроса
        if (response.status) {

            // Закрываем диалог настройки
            TotpSetupDialog.instance?.modal?.close();

            // Toast: TOTP включён
            Toast.success(t("forms.user_setting_security.toasts.totp_enabled"));

            // Обновляем карточку TOTP
            await refreshTotpStatus(form);

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если код неверный
        if (getErrorMessage(error).includes("CODE_INVALID")) {
            Toast.error(t("forms.user_setting_security.toasts.totp_invalid_code"));
            isToastShown = true;
        }

        // Если код не введён
        if (getErrorMessage(error).includes("CODE_REQUIRED")) {
            Toast.error(t("forms.user_setting_security.toasts.code_required"));
            isToastShown = true;
        }

        // Если превышено количество попыток
        if (getErrorMessage(error).includes("TOO_MANY_ATTEMPTS")) {
            Toast.error(t("forms.user_setting_security.toasts.too_many_attempts"));
            isToastShown = true;
        }

        // Если настройка устарела (секрет перезаписан или сессия обновлена)
        if (getErrorMessage(error).includes("SETUP_NOT_STARTED")) {
            Toast.error(t("forms.user_setting_security.toasts.totp_setup_expired"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.user_setting_security.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
