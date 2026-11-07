// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем forms
import { Confirm } from "../../confirm/index.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { loginRequest } from "../requests/login.js";

// Импортируем типы
import type { Login } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Авторизация по email и паролю.
 * @param form - Форма входа.
 * ***************************************************************************
 */
export async function loginHandler(form: Login): Promise<void> {

    try {

        // password
        const email = form.tpl?.querySelector<HTMLInputElement>(`[name="email"]`);
        const password = form.tpl?.querySelector<HTMLInputElement>(`[name="password"]`);
        const userAgent = window.navigator.userAgent;
        const platform = PlatformBridge.platform;

        // Запрос
        const response = await loginRequest({
            email: email?.value.trim().toLowerCase() ?? "",
            password: password?.value.trim() ?? "",
            user_agent: userAgent,
            platform: platform
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму регистрации
            form.modal?.close();

            // Получаем id сесии
            const sessionId = response.data.session_id;

            // Если у пользователя включён TOTP — код придёт из приложения-генератора
            if (response.data.totp_required) {

                // Toast: ввод кода из приложения-генератора
                Toast.success(t("forms.login.toasts.success_totp_required"));

                // Открываем форму подтверждения в TOTP-режиме
                new Confirm({ session_id: sessionId, email: email?.value.trim().toLowerCase() ?? "", totp_required: true });

                return;

            }

            // Toast успеха: код подтверждения отправлен на почту
            Toast.success(t("forms.login.toasts.success_code_sent"));

            // Открываем форму подтверждения
            // (email нормализуем так же, как в запросе: trim+lowercase,
            // иначе в описании формы отобразятся пробелы ввода)
            new Confirm({ session_id: sessionId, email: email?.value.trim().toLowerCase() ?? "" });

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если пользователь не найден
        if (getErrorMessage(error).includes("USER_NOT_FOUND")) {
            Toast.error(t("forms.login.toasts.user_not_found"));
            isToastShown = true;
        }

        // Если неверный пароль
        if (getErrorMessage(error).includes("PASSWORD_MISMATCH")) {
            Toast.error(t("forms.login.toasts.password_not_math"));
            isToastShown = true;
        }

        // Если аккаунт заблокирован
        if (getErrorMessage(error).includes("USER_BLOCKED")) {
            Toast.error(t("forms.login.toasts.user_blocked"));
            isToastShown = true;
        }

        // Если email некорректный
        if (getErrorMessage(error).includes("INVALID_EMAIL")) {
            Toast.error(t("forms.login.toasts.invalid_email"));
            isToastShown = true;
        }

        // Если не ввели email
        if (getErrorMessage(error).includes("EMAIL_REQUIRED")) {
            Toast.error(t("forms.login.toasts.not_email"));
            isToastShown = true;
        }

        // Если не ввели пароль
        if (getErrorMessage(error).includes("PASSWORD_REQUIRED")) {
            Toast.error(t("forms.login.toasts.not_password"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.login.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
