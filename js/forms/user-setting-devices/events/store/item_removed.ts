// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isSessionListItem } from "../../types.js";
import type { UserSettingDevices } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления сессии: убирает отображённые копии строки
 * и, если список опустел, показывает заглушку «Других активных сессий нет».
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: UserSettingDevices): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isSessionListItem(data)) return;

            // Если в списке не осталось других сессий — показываем заглушку
            // (DOM-копии стор снимает сам)
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error)
    }

}
