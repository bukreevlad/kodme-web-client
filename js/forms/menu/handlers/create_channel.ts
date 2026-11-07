// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ChannelCreate } from "../../channel-create/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие формы создания канала.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function createChannelHandler(form: Menu): void {

    try {

        // Открываем форму
        if (ChannelCreate.instance) {
            ChannelCreate.instance?.modal?.activate();
        } else {
            new ChannelCreate();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
