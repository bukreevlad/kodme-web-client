// Импортируем utils
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
        if (GroupCreate.instance) {
            GroupCreate.instance?.modal?.activate();
        } else {
            new GroupCreate();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
