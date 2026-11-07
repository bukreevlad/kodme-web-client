// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { confirmRequest } from "../requests/confirm.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";

/**
 * ***************************************************************************
 * Второй шаг восстановления пароля: подтверждение кода из письма.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export async function stepConfirmHandler(form: ForgotPassword): Promise<void> {

    try {

        // Email заполняется на первом шаге — без него подтверждать нечего
        if (!form.email) return;

        // Получаем поле кода (нет поля ввода — то же, что пустое значение:
        // сервер вернёт CODE_REQUIRED и покажет тост)
        const code = form.tpl?.querySelector<HTMLInputElement>(`[name="code"]`);
        const codeValue = code?.value.trim() ?? "";

        // Записываем значение на форму
        form.code = codeValue;

        // Запрос на подтверждение кода
        const response = await confirmRequest({
            email: form.email,
            code: codeValue
        });

        // Проверка запроса
        if (response.status) {

            // Toast успеха: код подтверждён
            Toast.success(window._lc.forms.forgot_password.toasts.success_code_confirmed);

            // Переключаем таб на ввод нового пароля
            form.tabs?.activateTab("password");

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если не ввели email
        if (getErrorMessage(error).includes("EMAIL_REQUIRED")) {
            Toast.error(window._lc.forms.forgot_password.toasts.not_email);
            isToastShown = true;
        }

        // Если email некорректный
        if (getErrorMessage(error).includes("INVALID_EMAIL")) {
            Toast.error(window._lc.forms.forgot_password.toasts.invalid_email);
            isToastShown = true;
        }

        // Если код не введён
        if (getErrorMessage(error).includes("CODE_REQUIRED")) {
            Toast.error(window._lc.forms.forgot_password.toasts.code_required);
            isToastShown = true;
        }

        // Если код неверный или истёк
        if (getErrorMessage(error).includes("CODE_INVALID")) {
            Toast.error(window._lc.forms.forgot_password.toasts.code_invalid);
            isToastShown = true;
        }

        // Если превышено количество попыток
        if (getErrorMessage(error).includes("TOO_MANY_ATTEMPTS")) {
            Toast.error(window._lc.forms.forgot_password.toasts.too_many_attempts);
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(window._lc.forms.forgot_password.toasts.too_many_requests);
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error);
        }

    }

}
