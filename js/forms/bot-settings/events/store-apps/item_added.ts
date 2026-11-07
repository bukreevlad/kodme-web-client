// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createApplicationItem } from "../../components/application/application.js";

// Импортируем типы
import { isBotAppRecord } from "../../types.js";
import type { BotSettings } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления приложения бота в список формы.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: BotSettings): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.storeApps.on("item::added", (data) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isBotAppRecord(data)) return;

            // Создаем DOM-элемент
            let item = createApplicationItem(form, data);

            // Добавляем в список
            form.listApps?.appendChild(item);

        });

    } catch (error) {
        Logger.error(error);
    }

}
