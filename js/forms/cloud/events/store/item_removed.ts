// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { Cloud } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события удаления элементов из хранилищ формы: обновляет
 * пустые состояния (DOM-копии элемента стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Cloud): void {

    try {

        // Подписываемся на событие удаления элемента
        form.store.on("item::removed", () => {

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

        // Подписываемся на событие удаления доступной ссылки
        form.availableStore.on("item::removed", () => {

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

        // Подписываемся на событие удаления элемента общего доступа
        form.sharedStore.on("item::removed", () => {

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

    } catch (error) {
        Logger.error(error);
    }

}
