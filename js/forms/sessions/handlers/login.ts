// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем типы
import type { Sessions } from "../index.js";

/**
 * ***************************************************************************
 * Переход из списка сессий ко входу.
 * @param form - Форма выбора сессий.
 * ***************************************************************************
 */
export async function loginHandler(form: Sessions): Promise<void> {

    try {

        // Закрываем форму
        form.modal?.close();

        // Открываем форму Login
        new Login();

    } catch (error) {
        Logger.error(error);
    }

}
