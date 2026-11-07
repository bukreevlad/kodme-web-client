// Импортируем utils
import { Logger } from "../../../../../../utils/logs/logger.js";

// Импортируем components
import { createAppItem } from "../../components/application.js";

// Импортируем типы
import { isBotAppItem } from "../../../../requests/get_bot_info.js";
import type { BotAppsList } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка добавления приложения бота в UI.
 * @param form - Экземпляр диалога приложений.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: BotAppsList): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isBotAppItem(data)) return;

            // Создаем DOM-элемент
            const item = createAppItem(form, data);

            // Добавляем в список
            form.list?.appendChild(item);

        });

    } catch (error) {
        Logger.error(error);
    }

}
