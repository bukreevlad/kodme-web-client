// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { AddBotApp } from "../../bot-app-create/index.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога добавления приложения бота.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function addAppHandler(form: BotSettings): void {

    try {

        // Открываем диалог создания приложения
        new AddBotApp({ botId: form.botId });

    } catch (error) {
        Logger.error(error);
    }

}
