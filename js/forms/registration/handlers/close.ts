// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Загружаем forms
import { Sessions } from "../../sessions/index.js";
import { Login } from "../../login/index.js";

// Импортируем типы
import type { Registration } from "../index.js";

/**
 * ***************************************************************************
 * Закрытие формы регистрации: возврат к списку сессий или ко входу.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export function closeHandler(form: Registration): void {

    try {

        // Закрываем форму
        form.modal?.close();

        // Открываем сессии или вход
        const sessions = LocalStorage.getAllSessions();
        sessions.length > 0 ? new Sessions() : new Login();

    } catch (error) {
        Logger.error(error);
    }

}
