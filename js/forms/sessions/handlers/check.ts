// Импортируем config
import { applyServerLimits } from "../../../config/limits.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Login } from "../../login/index.js";
import { Home } from "../../home/index.js";

// Импортируем handlers
import { refreshHandler } from "./refresh.js";

// Импортируем requests
import { checkRequest } from "../requests/check.js";

// Импортируем типы
import type { StoredSession } from "../../../utils/local_storage.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";
import type { Sessions } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Проверка сохранённой сессии на сервере и вход в аккаунт.
 * @param form - Форма выбора сессий.
 * @param data - Данные сессии.
 * ***************************************************************************
 */
export async function checkHandler(form: Sessions, data: StoredSession): Promise<void> {

    try {

        // Запрос
        const response = await checkRequest({
            access_token: data.access_token
        });

        // Проверка запроса
        if (response.status) {

            // Закрываем форму сессий
            form.modal?.close();

            // Получаем сессию для обновления (без неё обновлять нечего)
            const session = LocalStorage.getSession(data.id);
            if (!session) return;

            // Обновляем данные
            session.user = response.data.user_data;

            // Лимиты и справочник типов файлов кладём в память: единственный
            // их источник — этот ответ, дальше они живут до перезагрузки
            applyServerLimits(response.data.server_data);

            // Серверные настройки дописываются в сессию отдельным полем
            // (легаси писал `session.server = ...` — поле отсутствует в
            // типе StoredSession, поэтому присваиваем через Object.assign
            // с тем же эффектом в runtime)
            Object.assign(session, { server: response.data.server_data });

            // Обновляем данные сессии
            LocalStorage.updateSession(session);
            LocalStorage.session = session;
            LocalStorage.setLastActionSession(data.id);
            LocalStorage.sessionId = data.id;

            // В вашем основном приложении (app.js), когда юзер залогинился:
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: "SET_TOKEN",
                    token: session.refresh_token
                });
            }

            // Открываем домашнюю форму
            new Home({});

        }

    } catch (error) {

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если токен истек
        if (getErrorMessage(error).includes("Token has expired")) {
            Logger.warn("[app][auth]: Токен истёк");

            // Выполняем refresh token
            await refreshHandler(form, data);

            // Если refresh не удался — refreshHandler уже удалил сессию и показал тост
            const session = LocalStorage.getSession(data.id);
            if (!session) return;

            // Вызываем повторную авторизацию
            checkHandler(form, session);

            return;

        }

        // Если сессия не найдена
        if (getErrorMessage(error).includes("SESSION_NOT_FOUND")) {

            // Удаляем сессию
            await LocalStorage.removeSession(data.id);
            form.store.remove(data.id);

            // Toast (флаг isToastShown не выставляем: ветка завершается
            // return и fallback-тост ниже недостижим)
            Toast.error(t("forms.sessions.toasts.session_not_exist"));

            // Получаем сессии
            const sessions = LocalStorage.getAllSessions();

            // Проверка сессий
            if (sessions.length === 0) {
                form.modal?.close();
                new Login();
            }

            return;

        }

        // Если неверная подпись или сменили secret
        if (getErrorMessage(error).includes("Invalid token format or signature")) {
            Logger.warn("[app][auth]: Токен не прошёл проверку. Подпись недействительна");

            // Toast (флаг isToastShown не выставляем: ниже return)
            Toast.error(t("api.errors.invalid_token_signature"));

            return;

        }

        // Если ошибка сервера
        if (getErrorMessage(error).includes("502")) {

            // Toast (флаг isToastShown не выставляем: ниже return)
            Toast.error(t("api.errors.server_not_responde"));

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
