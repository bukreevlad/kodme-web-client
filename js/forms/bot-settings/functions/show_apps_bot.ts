// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Перенос приложений бота из профиля в хранилище формы: строки списка
 * отрисуются подпиской на событие стора (см. events/store-apps).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function showAppsBot(form: BotSettings): void {

    try {

        // Получаем все приложения бота
        let apps = form.profile?.apps || [];

        // Проходим по списку
        apps.forEach(app => {

            // Добавляем в хранилище
            form.storeApps.add(app);

        });

    } catch (error) {
        Logger.error(error);
    }

}
