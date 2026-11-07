// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isForwardChannel } from "../../types.js";
import type { ForwardMessages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления канала: убирает отображённые копии строки
 * списка.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: ForwardMessages): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            const record = isForwardChannel(data) ? data : null;
            const elements = record?.__domElements__;

            // Проверяем наличие массива элементов
            if (elements && Array.isArray(elements)) {
                elements.forEach(element => {
                    if (element && typeof element.remove === "function") {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${elements.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                record.__domElements__ = [];
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
