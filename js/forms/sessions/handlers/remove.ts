// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем типы
import type { UserSessionItem } from "../components/session.js";

/**
 * ***************************************************************************
 * Удаление сохранённой сессии из списка.
 * @param event - Событие клика по кнопке удаления.
 * @param element - Элемент списка сессий.
 * ***************************************************************************
 */
export async function removeHandler(event: Event, element: UserSessionItem): Promise<void> {

    try {

        // Выполняем stopPropagation
        event.stopPropagation();

        // Удаляем сессию из LocalStorage
        await LocalStorage.removeSession(element.getData().id);

        // Удаляем элемент из Store формы
        element.form.store.remove(element.getData().id);

        // Toast успеха: сессия удалена
        Toast.success(window._lc.forms.sessions.toasts.success_remove);

        // Получаем все сессии
        const allSessions = LocalStorage.getAllSessions();

        // Если сессий нет, закрываем форму
        if (allSessions.length === 0) {

            element.form.modal?.close();
            new Login();

        }

    } catch (error) {
        Logger.error(error);

        // Toast: общая ошибка
        Toast.error(window._lc.api.errors.server_error);

    }

}
