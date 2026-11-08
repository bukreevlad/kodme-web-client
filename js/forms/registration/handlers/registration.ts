// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Inputs } from "../../../components/inputs.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем requests
import { registrationRequest } from "../requests/registration.js";

// Импортируем типы
import type { Registration } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Финальный шаг регистрации: локальная валидация пароля и запрос на сервер.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export async function registrationHandler(form: Registration): Promise<void> {

    try {

        // Без шаблона шаг заполнять нечего
        const tpl = form.tpl;
        if (!tpl) return;

        // password
        const password = tpl.querySelector<HTMLInputElement>(`[name="password"]`);
        const retryPassword = tpl.querySelector<HTMLInputElement>(`[name="retry-password"]`);

        // Поля обязаны входить в шаблон — иначе заполнять и подсвечивать нечего
        if (!password || !retryPassword) return;

        // Записываем значение на форму
        form.password = password.value;
        form.retryPassword = retryPassword.value;

        // Локальная валидация пароля
        if (!form.password) {
            Inputs.markInvalid(password, true);
            Toast.error(t("forms.registration.toasts.not_password"));
            return;
        }

        // Если пароль слишком короткий
        if (form.password.length < 8) {
            Inputs.markInvalid(password, true);
            Toast.warning(t("forms.registration.toasts.password_too_short"));
            return;
        }

        // Если пароли не совпадают
        if (form.password !== form.retryPassword) {
            Inputs.markInvalid(retryPassword, true);
            Toast.error(t("forms.registration.toasts.passwords_not_match"));
            return;
        }

        // Убираем подсветку ошибки
        Inputs.markInvalid(password, false);
        Inputs.markInvalid(retryPassword, false);

        // Поля предыдущих шагов опциональны в типе: пустая строка уходит
        // на сервер и получает валидную серверную ошибку
        const response = await registrationRequest({
            email: form.email ?? "",
            first_name: form.firstName ?? "",
            last_name: form.lastName ?? "",
            password: form.password,
            retry_password: form.retryPassword
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму регистрации
            form.modal?.close();

            // Toast успеха
            Toast.success(t("forms.registration.toasts.success_registration"));

            // Открываем форму авторизации
            new Login();

        }

    } catch (error) {
        Logger.error(error);

        // Если такой email уже зарегистрирован
        if (getErrorMessage(error).includes("EMAIL_ALREADY_TAKEN")) {
            Toast.error(t("forms.registration.toasts.email_already_taken"));
        }

        // Если не ввели email
        if (getErrorMessage(error).includes("EMAIL_REQUIRED")) {
            Toast.error(t("forms.registration.toasts.not_email"));
        }

        // Если email некорректный
        if (getErrorMessage(error).includes("INVALID_EMAIL")) {
            Toast.error(t("forms.registration.toasts.invalid_email"));
        }

        // Если не ввели имя
        if (getErrorMessage(error).includes("FIRST_NAME_REQUIRED")) {
            Toast.error(t("forms.registration.toasts.not_first_name"));
        }

        // Если имя некорректное
        if (getErrorMessage(error).includes("INVALID_FIRST_NAME")) {
            Toast.error(t("forms.registration.toasts.invalid_first_name"));
        }

        // Если не ввели фамилию
        if (getErrorMessage(error).includes("LAST_NAME_REQUIRED")) {
            Toast.error(t("forms.registration.toasts.not_last_name"));
        }

        // Если фамилия некорректная
        if (getErrorMessage(error).includes("INVALID_LAST_NAME")) {
            Toast.error(t("forms.registration.toasts.invalid_last_name"));
        }

        // Если не ввели пароль
        if (getErrorMessage(error).includes("PASSWORD_REQUIRED")) {
            Toast.error(t("forms.registration.toasts.not_password"));
        }

        // Если не ввели повтор пароля
        if (getErrorMessage(error).includes("RETRY_PASSWORD_REQUIRED")) {
            Toast.error(t("forms.registration.toasts.not_retry_password"));
        }

        // Если пароли не совпадают
        if (getErrorMessage(error).includes("PASSWORDS_NOT_MATCH")) {
            Toast.error(t("forms.registration.toasts.passwords_not_match"));
        }

        // Если пароль слишком короткий
        if (getErrorMessage(error).includes("PASSWORD_TOO_SHORT")) {
            Toast.warning(t("forms.registration.toasts.password_too_short"));
        }

        // Если аккаунт заблокирован
        if (getErrorMessage(error).includes("USER_BLOCKED")) {
            Toast.error(t("forms.registration.toasts.user_blocked"));
        }

        // Если регистрация выключена
        if (getErrorMessage(error).includes("MODULE_DISABLED")) {
            Toast.error(t("forms.registration.toasts.module_disabled"));
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.registration.toasts.too_many_requests"));
        }

    }

}
