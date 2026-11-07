// Импортируем utils
import { LocalStorage } from "../../../../../utils/local_storage.js";
import { Logger } from "../../../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем requests
import { confirmQrcodeLoginRequest } from "../requests/confirm.js";

// Импортируем типы
import type { ConfirmQRCodeLogin } from "../index.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подтверждение входа по QR-коду: закрывает диалог при успехе, показывает
 * тост с разбором кодов ошибок при неудаче.
 * @param form - Диалог подтверждения.
 * ***************************************************************************
 */
export async function confirmHandler(form: ConfirmQRCodeLogin): Promise<void> {

    try {

        // Получаем сессию пользователя
        let session = LocalStorage.session;

        // Запрос на сервер
        let response = await confirmQrcodeLoginRequest({
            qr_session_id: form.scannedResult.session_id,
            refresh_token: session?.refresh_token ?? ""
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму только при успешном подтверждении
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.error(t("forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.toasts.too_many_requests"));
        } else {

            // Общая ошибка при подтверждении входа
            Toast.error(t("forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.toasts.error"));

        }

    }

}
