// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { confirmRequest } from "../requests/confirm.js";

// Импортируем forms
import { Sessions } from "../../sessions/index.js";

// Импортируем типы
import type { Confirm } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подтверждение кода входа и сохранение новой сессии.
 * @param form - Форма подтверждения.
 * ***************************************************************************
 */
export async function confirmHandler(form: Confirm): Promise<void> {

    try {

        // password
        const code = form.tpl?.querySelector<HTMLInputElement>(`[name="code"]`);

        // Запрос
        const response = await confirmRequest({
            session_id: form.sessionId,
            code: code?.value.trim() ?? ""
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму подтверждения
            form.modal?.close();

            // Сохраняем сессию
            LocalStorage.saveSession({
                user: {
                    avatar_host_url: response.data.avatar_host_url,
                    display_name: response.data.display_name,
                    email: form.email
                },
                session_id: form.sessionId,
                access_token: response.data.pair_token.accessToken,
                refresh_token: response.data.pair_token.refreshToken
            });

            // Toast успеха: вход в аккаунт выполнен
            Toast.success(t("forms.confirm.toasts.success_login"));

            // Открываем форму Sessions
            new Sessions();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если код неверный
        if (getErrorMessage(error).includes("CODE_INVALID")) {
            Toast.error(t("forms.confirm.toasts.code_invalid"));
            isToastShown = true;
        }

        // Если код истёк
        if (getErrorMessage(error).includes("CODE_EXPIRED")) {
            Toast.error(t("forms.confirm.toasts.code_expired"));
            isToastShown = true;
        }

        // Если код не введён
        if (getErrorMessage(error).includes("CODE_REQUIRED")) {
            Toast.error(t("forms.confirm.toasts.code_required"));
            isToastShown = true;
        }

        // Если превышено количество попыток
        if (getErrorMessage(error).includes("TOO_MANY_ATTEMPTS")) {
            Toast.error(t("forms.confirm.toasts.too_many_attempts"));
            isToastShown = true;
        }

        // Если сессия не найдена или истекла
        if (getErrorMessage(error).includes("SESSION_NOT_FOUND") || getErrorMessage(error).includes("SESSION_ID_INVALID") || getErrorMessage(error).includes("SESSION_ID_REQUIRED")) {
            Toast.error(t("forms.confirm.toasts.session_not_found"));
            isToastShown = true;
        }

        // Если пользователь не найден
        if (getErrorMessage(error).includes("USER_NOT_FOUND")) {
            Toast.error(t("forms.confirm.toasts.user_not_found"));
            isToastShown = true;
        }

        // Если аккаунт заблокирован
        if (getErrorMessage(error).includes("USER_BLOCKED")) {
            Toast.error(t("forms.confirm.toasts.user_blocked"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.confirm.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
