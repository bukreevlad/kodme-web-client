// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isContactRecord } from "../../types.js";
import type { Contacts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления контакта: убирает отображённые копии строки
 * и, если список опустел, показывает пустое состояние.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemRemoved(form: Contacts): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Проверяем наличие массива элементов
            const record = isContactRecord(data) ? data : null;
            const elements = record?.__domElements__;
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

            // Если удалили последний контакт — показываем пустое состояние
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
