// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ForgotPassword } from "../../forgot-password/index.js";

// Импортируем типы
import type { Login } from "../index.js";

/**
 * ***************************************************************************
 * Переход из формы входа к восстановлению пароля.
 * @param form - Форма входа.
 * ***************************************************************************
 */
export function forgotPasswordHandler(form: Login): void {

    try {

        // Закрываем форму Login
        form.modal?.close();

        // Открываем форму восстановления пароля
        new ForgotPassword();

    } catch (error) {
        Logger.error(error);
    }

}
