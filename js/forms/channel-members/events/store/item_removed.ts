// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isMemberRecord } from "../../types.js";
import type { ChannelMembers } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления участника из UI: обновляет пустое состояние
 * списка (DOM-копии строки стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: ChannelMembers): void {

    try {

        // Подписываемся на событие удаления элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isMemberRecord(data)) return;

            // Если удалили последнего участника — показываем пустое состояние
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
