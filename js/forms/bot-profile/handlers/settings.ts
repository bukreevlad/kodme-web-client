// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { BotSettings } from "../../bot-settings/index.js";

// Импортируем типы
import type { BotProfile } from "../index.js";

/**
 * ***************************************************************************
 * Открытие настроек бота (только для владельца — кнопку скрывает форма).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function settingsHandler(form: BotProfile): Promise<void> {

    try {

        // Открываем форму
        new BotSettings({ botId: form.botId });

    } catch (error) {
        Logger.error(error);
    }

}
