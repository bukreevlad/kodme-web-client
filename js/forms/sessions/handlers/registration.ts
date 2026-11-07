// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Registration } from "../../registration/index.js";

// Импортируем типы
import type { Sessions } from "../index.js";

/**
 * ***************************************************************************
 * Переход из списка сессий к регистрации.
 * @param form - Форма выбора сессий.
 * ***************************************************************************
 */
export async function registrationHandler(form: Sessions): Promise<void> {

    try {

        // Закрываем форму
        form.modal?.close();

        // Открываем форму Registration
        new Registration();

    } catch (error) {
        Logger.error(error);
    }

}
