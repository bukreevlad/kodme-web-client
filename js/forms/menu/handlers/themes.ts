// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Themes } from "../../themes/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие формы смены темы оформления.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function themesHandler(form: Menu): void {

    try {

        // Открываем форму
        if (FormsRegistry.getOwner<Themes>("themes")) {
            FormsRegistry.getOwner<Themes>("themes")?.modal?.activate();
        } else {
            new Themes();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
