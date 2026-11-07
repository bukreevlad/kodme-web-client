// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Login } from "../../login/index.js";

// Импортируем типы
import type { LoginWithQRCode } from "../index.js";

/**
 * ***************************************************************************
 * Возврат на форму входа по email/паролю.
 * @param form - Форма.
 * ***************************************************************************
 */
export function backHandler(form: LoginWithQRCode): void {

    try {

        // Закрываем форму Login
        form.modal?.close();

        // Открываем форму регистрации
        new Login();

    } catch (error) {
        Logger.error(error);
    }

}
