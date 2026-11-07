// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isGroupTopicRecord } from "../../types.js";
import type { GroupTopicsManager } from "../../index.js";

/**
 * ************************************************************************
 * Подписка на удаление элемента из локального стора формы: снимает
 * отрисованные копии строки из DOM и обновляет пустое состояние.
 * @param form - Экземпляр формы.
 * ************************************************************************
 */
export function subscribeItemRemoved(form: GroupTopicsManager): void {

    // Подписываемся на событие удаления элемента
    form.store.on("item::removed", (data) => {

        // Пейлоад типизирован как unknown: работаем только с записью темы
        if (!isGroupTopicRecord(data)) return;

        // Проверяем наличие массива отрисованных копий элемента
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

        // Если удалили последнюю тему — показываем пустое состояние
        updateEmptyState(form);

    });

}
