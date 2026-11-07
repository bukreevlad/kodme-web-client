// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Registration } from "../../registration/index.js";

// Импортируем типы
import type { Login } from "../index.js";

/**
 * ***************************************************************************
 * Переход из формы входа к регистрации.
 * @param form - Форма входа.
 * ***************************************************************************
 */
export function registrationHandler(form: Login): void {

    try {

        // Закрываем форму Login
        form.modal?.close();

        // Открываем форму регистрации
        new Registration();

    } catch (error) {
        Logger.error(error);
    }

}
