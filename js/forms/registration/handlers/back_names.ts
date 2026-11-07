// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Registration } from "../index.js";

/**
 * ***************************************************************************
 * Назад с шага «пароль» к вводу имени и фамилии.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export function backNamesHandler(form: Registration): void {

    try {

        // Переключаем таб
        form.tabs?.activateTab("names");

    } catch (error) {
        Logger.error(error);
    }

}
