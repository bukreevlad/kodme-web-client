// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { totpSetupRequest } from "../requests/totp_setup.js";

// Импортируем dialogs
import { TotpSetupDialog } from "../../user-totp-setup/index.js";

// Импортируем handlers
import { confirmTotpHandler } from "./confirm_totp.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";

/**
 * ***************************************************************************
 * Включение TOTP: запрашивает неподтверждённый секрет и открывает диалог
 * с QR-кодом и вводом первого кода.
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export async function enableTotpHandler(form: UserSettingSecurity): Promise<void> {

    try {

        // Запрос шага включения
        const response = await totpSetupRequest();

        // Проверка запроса
        if (response.status) {

            // Открываем диалог с QR-кодом; подтверждение кода — confirmTotpHandler
            new TotpSetupDialog({
                qrImage: response.data.qr_image,
                secret: response.data.secret,
                digits: response.data.digits,
                step: response.data.step,
                insertInto: form.modal?.content,
                callback: (code) => confirmTotpHandler(form, code)
            });

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если TOTP уже включён
        if (getErrorMessage(error).includes("ALREADY_ENABLED")) {
            Toast.error(window._lc.forms.user_setting_security.toasts.totp_already_enabled);
            isToastShown = true;
        }

        // Если TOTP запрещён на сервере
        if (getErrorMessage(error).includes("DISABLED")) {
            Toast.error(window._lc.forms.user_setting_security.toasts.security_disabled);
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(window._lc.forms.user_setting_security.toasts.too_many_requests);
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
