// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ForgotPassword } from "../index.js";

/**
 * ***************************************************************************
 * Назад с шага «новый пароль» к вводу кода.
 * @param form - Форма восстановления пароля.
 * ***************************************************************************
 */
export function backCodeHandler(form: ForgotPassword): void {

    try {

        // Переключаем таб на ввод кода
        form.tabs?.activateTab("code");

    } catch (error) {
        Logger.error(error);
    }

}
