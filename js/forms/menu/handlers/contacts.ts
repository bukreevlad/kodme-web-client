// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Contacts } from "../../contacts/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие контактов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function contactsHandler(form: Menu): void {

    try {

        // Открываем форму
        if (Contacts.instance) {
            Contacts.instance?.modal?.activate();
        } else {
            new Contacts();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
