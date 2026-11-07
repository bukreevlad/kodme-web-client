// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isThemeItem } from "../../types.js";
import type { Themes } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления темы из UI: убирает отображённые копии
 * элемента и обновляет пустое состояние списка.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Themes): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isThemeItem(data)) return;

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

            // Если удалили последнюю тему — показываем пустое состояние
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
