// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Meets } from "../../meets/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие митингов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function meetsHandler(form: Menu): void {

    try {

        // Открываем форму
        if (Meets.instance) {
            Meets.instance?.modal?.activate();
        } else {
            new Meets();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
