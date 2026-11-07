// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { refreshRequest } from "../requests/refresh.js";

// Импортируем типы
import type { StoredSession } from "../../../utils/local_storage.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";
import type { Sessions } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обновление access-токена сессии по refresh-токену.
 * @param form - Форма выбора сессий.
 * @param data - Данные сессии.
 * ***************************************************************************
 */
export async function refreshHandler(form: Sessions, data: StoredSession): Promise<void> {

    try {

        // Запрос
        const response = await refreshRequest({
            refresh_token: data.refresh_token
        });

        // Проверка запроса
        if (response.status) {

            // Получаем сессию для обновления
            const session = LocalStorage.getSession(data.id);

            // Обновляем данные
            if (session) session.access_token = response.data.access_token;

            // Обновляем данные сессии
            LocalStorage.updateSession(session);

        }

    } catch (error) {

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если сессия не найдена
        if (getErrorMessage(error).includes("SESSION_NOT_FOUND")) {

            // Удаляем сессию
            LocalStorage.removeSession(data.id);
            form.store.remove(data.id);
            return;

        }

        // Если токен истек или невалиден
        if (getErrorMessage(error).includes("Token has expired")
            || getErrorMessage(error).includes("TOKEN_INVALID")
            || getErrorMessage(error).includes("REFRESH_TOKEN_INVALID")) {

            // Удаляем сессию
            LocalStorage.removeSession(data.id);
            form.store.remove(data.id);

            // Toast
            Toast.warning(t("forms.sessions.toasts.session_expired"));
            isToastShown = true;

            // Получаем сессии
            const sessions = LocalStorage.getAllSessions();

            // Проверка сессий
            if (sessions.length === 0) {
                form.modal?.close();
                new Login();
            }

            return;

        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.sessions.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — логируем и показываем общий тост
        if (!isToastShown) {
            Logger.error(error);

            // Toast
            Toast.error(t("api.errors.server_error"));
        }

    }

}
