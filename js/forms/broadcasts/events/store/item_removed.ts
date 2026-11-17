// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isBroadcastCast } from "../../types.js";
import type { Broadcasts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления трансляции: если список опустел, показывает
 * пустое состояние (DOM-копии карточки стор снимает сам).
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemRemoved(form: Broadcasts): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isBroadcastCast(data)) return;

            // Если удалили последнюю трансляцию — показываем пустое состояние
            // (DOM-копии стор снимает сам)
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error)
    }

}
