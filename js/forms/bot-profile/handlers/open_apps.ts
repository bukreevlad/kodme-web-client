// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { BotAppsList } from "../dialogs/apps-list/index.js";

// Импортируем типы
import type { BotProfile } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога приложений бота.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function openAppsHandler(form: BotProfile): Promise<void> {

    try {

        // Открываем форму
        new BotAppsList({ botId: form.botId, apps: form?.profile?.apps });

    } catch (error) {
        Logger.error(error);
    }

}
