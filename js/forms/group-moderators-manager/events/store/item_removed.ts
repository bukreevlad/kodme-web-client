// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isGroupModeratorRecord } from "../../types.js";
import type { GroupModeratorsManager } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на удаление элемента из локального стора формы: обновляет
 * пустое состояние списка (DOM-копии строки стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: GroupModeratorsManager): void {

    // Подписываемся на событие удаления элемента
    form.store.on("item::removed", (data) => {

        // Пейлоад типизирован как unknown: работаем только с записью модератора
        if (!isGroupModeratorRecord(data)) return;

        // Если удалили последнего модератора — показываем пустое состояние
        updateEmptyState(form);

    });

}
