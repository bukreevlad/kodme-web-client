// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем requests
import { setPasswordRequest } from "../requests/set_password.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";

/**
 * ***************************************************************************
 * Третий шаг восстановления пароля: установка нового пароля.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export async function stepSetPasswordHandler(form: ForgotPassword): Promise<void> {

    try {

        // Email и код заполняются на предыдущих шагах — без них новый
        // пароль не установить
        if (!form.email || !form.code) return;

        // Получаем поля пароля (нет поля ввода — то же, что пустое значение:
        // сервер вернёт PASSWORD_REQUIRED и покажет тост)
        const password = form.tpl?.querySelector<HTMLInputElement>(`[name="password"]`);
        const retryPassword = form.tpl?.querySelector<HTMLInputElement>(`[name="retry-password"]`);
        const passwordValue = password?.value ?? "";
        const retryPasswordValue = retryPassword?.value ?? "";

        // Записываем значения на форму
        form.password = passwordValue;
        form.retryPassword = retryPasswordValue;

        // Запрос на установку нового пароля
        const response = await setPasswordRequest({
            email: form.email,
            code: form.code,
            password: passwordValue,
            retryPassword: retryPasswordValue
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму восстановления
            form.modal?.close();

            // Toast успеха: пароль изменён
            Toast.success(window._lc.forms.forgot_password.toasts.success_password_changed);

            // Открываем форму авторизации
            new Login();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если пароль не введён
        if (getErrorMessage(error).includes("PASSWORD_REQUIRED")) {
            Toast.error(window._lc.forms.forgot_password.toasts.not_password);
            isToastShown = true;
        }

        // Если повтор пароля не введён
        if (getErrorMessage(error).includes("RETRY_PASSWORD_REQUIRED")) {
            Toast.error(window._lc.forms.forgot_password.toasts.not_retry_password);
            isToastShown = true;
        }

        // Если пароли не совпадают
        if (getErrorMessage(error).includes("PASSWORDS_NOT_MATCH")) {
            Toast.error(window._lc.forms.forgot_password.toasts.passwords_not_match);
            isToastShown = true;
        }

        // Если пароль слишком короткий
        if (getErrorMessage(error).includes("PASSWORD_TOO_SHORT")) {
            Toast.warning(window._lc.forms.forgot_password.toasts.password_too_short);
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
