// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";

/**
 * ***************************************************************************
 * Назад с шага «код» к вводу email.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export function backEmailHandler(form: ForgotPassword): void {

    try {

        // Переключаем таб на ввод email
        form.tabs?.activateTab("email");

    } catch (error) {
        Logger.error(error);
    }

}
