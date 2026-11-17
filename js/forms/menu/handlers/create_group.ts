// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { GroupCreate } from "../../group-create/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие формы создания группы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function createGroupHandler(form: Menu): void {

    try {

        // Открываем форму
        if (FormsRegistry.getOwner<GroupCreate>("group-create")) {
            FormsRegistry.getOwner<GroupCreate>("group-create")?.modal?.activate();
        } else {
            new GroupCreate();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
