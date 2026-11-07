// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";

/**
 * ***************************************************************************
 * Закрытие формы восстановления: возврат к авторизации.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export function closeHandler(form: ForgotPassword): void {

    try {

        // Закрываем форму восстановления
        form.modal?.close();

        // Открываем форму авторизации
        new Login();

    } catch (error) {
        Logger.error(error);
    }

}
