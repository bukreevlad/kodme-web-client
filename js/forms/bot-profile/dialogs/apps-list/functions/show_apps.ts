// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем типы
import type { BotAppsList } from "../index.js";

/**
 * ***************************************************************************
 * Загрузка приложений бота в стор диалога: каждое приложение добавляется
 * отдельной строкой (DOM создаёт подписка стора на item::added).
 * @param form - Экземпляр диалога приложений.
 * ***************************************************************************
 */
export function showApps(form: BotAppsList): void {

    try {

        // Получаем все приложения бота
        const apps = form?.apps || [];

        // Проходим по списку
        apps.forEach(app => {

            // добавляем в стор
            form.store.add(app);

        });

    } catch (error) {
        Logger.error(error);
    }

}
