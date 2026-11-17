// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isContactRecord } from "../../types.js";
import type { Contacts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления контакта: если список опустел, показывает
 * пустое состояние (DOM-копии строки стор снимает сам).
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemRemoved(form: Contacts): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isContactRecord(data)) return;

            // Если удалили последний контакт — показываем пустое состояние
            // (DOM-копии стор снимает сам)
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
