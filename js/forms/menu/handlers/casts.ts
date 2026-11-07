// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Broadcasts } from "../../broadcasts/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие эфиров.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function castsHandler(form: Menu): void {

    try {

        // Открываем форму
        if (Broadcasts.instance) {
            Broadcasts.instance?.modal?.activate();
        } else {
            new Broadcasts();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
