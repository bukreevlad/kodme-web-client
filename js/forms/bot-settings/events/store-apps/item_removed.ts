// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isBotAppRecord } from "../../types.js";
import type { BotSettings } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления приложения бота: убирает из списка все
 * отображённые копии его строки.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: BotSettings): void {

    try {

        // Подписываемся на событие удаление элемента
        form.storeApps.on("item::removed", (data) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isBotAppRecord(data)) return;

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
