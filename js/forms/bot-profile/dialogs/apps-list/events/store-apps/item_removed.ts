// Импортируем utils
import { Logger } from "../../../../../../utils/logs/logger.js";

// Импортируем типы
import { isBotAppItem } from "../../../../requests/get_bot_info.js";
import type { BotAppsList } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления приложения бота из UI: убирает отображённые
 * копии элемента.
 * @param form - Экземпляр диалога приложений.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: BotAppsList): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isBotAppItem(data)) return;

            // Проверяем наличие массива элементов
            if (data.__domElements__ && Array.isArray(data.__domElements__)) {
                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === "function") {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${data.__domElements__.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
