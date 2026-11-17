// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Cloud } from "../../cloud/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие облака.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function cloudHandler(form: Menu): Promise<void> {

    try {

        // Открываем форму
        if (FormsRegistry.getOwner<Cloud>("cloud")) {
            FormsRegistry.getOwner<Cloud>("cloud")?.modal?.activate();
        } else {
            new Cloud();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
