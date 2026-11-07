// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { totpDisableRequest } from "../requests/totp_disable.js";

// Импортируем functions
import { refreshTotpStatus } from "../functions/refresh_totp_status.js";

// Импортируем dialogs
import { TotpDisableDialog } from "../dialogs/totp_disable/index.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отключение TOTP: открывает диалог ввода действующего кода.
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export function disableTotpHandler(form: UserSettingSecurity): void {

    try {

        // Диалог отключения; подтверждение кода — disableTotpConfirmHandler
        new TotpDisableDialog({
            insertInto: form.modal?.content,
            callback: (code) => disableTotpConfirmHandler(form, code)
        });

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Подтверждение отключения TOTP действующим кодом.
 * @param form - Форма безопасности.
 * @param code - Действующий код из приложения-генератора.
 * ***************************************************************************
 */
export async function disableTotpConfirmHandler(form: UserSettingSecurity, code: string): Promise<void> {

    try {

        // Пустой код — вводить нечего
        if (!code) {
            Toast.error(t("forms.user_setting_security.toasts.code_required"));
            return;
        }

        // Запрос отключения
        const response = await totpDisableRequest({ code: code });

        // Проверка запроса
        if (response.status) {

            // Закрываем диалог отключения
            TotpDisableDialog.instance?.modal?.close();

            // Toast: TOTP отключён
            Toast.success(t("forms.user_setting_security.toasts.totp_disabled"));

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

        // Если TOTP уже выключен
        if (getErrorMessage(error).includes("NOT_ENABLED")) {
            Toast.error(t("forms.user_setting_security.toasts.totp_not_enabled"));
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
