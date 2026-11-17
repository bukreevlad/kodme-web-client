// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isMeetInvite } from "../../types.js";
import type { MeetManageInvites } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления приглашения: если список опустел, показывает
 * пустое состояние (DOM-копии строки стор снимает сам).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: MeetManageInvites): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isMeetInvite(data)) return;

            // Если удалили последнее приглашение — показываем пустое состояние
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
