// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Registration } from "../index.js";

/**
 * ***************************************************************************
 * Назад с шага «имя и фамилия» к вводу email.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export function backEmailHandler(form: Registration): void {

    try {

        // Переключаем таб
        form.tabs?.activateTab("email");

    } catch (error) {
        Logger.error(error);
    }

}
