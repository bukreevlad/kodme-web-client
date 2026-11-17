// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updatePasskeysEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isPasskeyListItem } from "../../types.js";
import type { UserSettingSecurity } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления ключа: убирает отображённые копии строки
 * и, если список опустел, показывает заглушку.
 *
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: UserSettingSecurity): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isPasskeyListItem(data)) return;

            // Если в списке не осталось ключей — показываем заглушку
            // (DOM-копии стор снимает сам)
            updatePasskeysEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
