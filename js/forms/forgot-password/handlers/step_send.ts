// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { sendRequest } from "../requests/send.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Первый шаг восстановления пароля: отправка кода на почту.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export async function stepSendHandler(form: ForgotPassword): Promise<void> {

    try {

        // Получаем поле email (нет поля ввода — то же, что пустое значение:
        // сервер вернёт EMAIL_REQUIRED и покажет тост)
        const email = form.tpl?.querySelector<HTMLInputElement>(`[name="email"]`);
        const emailValue = email?.value.trim().toLowerCase() ?? "";

        // Записываем значение на форму
        form.email = emailValue;

        // Запрос на отправку кода
        const response = await sendRequest({ email: emailValue });

        // Проверка запроса
        if (response.status) {

            // Toast успеха: код отправлен на почту
            Toast.success(t("forms.forgot_password.toasts.success_code_sent"));

            // Переключаем таб на ввод кода
            form.tabs?.activateTab("code");

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если не ввели email
        if (getErrorMessage(error).includes("EMAIL_REQUIRED")) {
            Toast.error(t("forms.forgot_password.toasts.not_email"));
            isToastShown = true;
        }

        // Если email некорректный
        if (getErrorMessage(error).includes("INVALID_EMAIL")) {
            Toast.error(t("forms.forgot_password.toasts.invalid_email"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.forgot_password.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
