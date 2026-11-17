// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isGroupTopicRecord } from "../../types.js";
import type { GroupTopicsManager } from "../../index.js";

/**
 * ************************************************************************
 * Подписка на удаление элемента из локального стора формы: обновляет
 * пустое состояние списка (DOM-копии строки стор снимает сам).
 * @param form - Экземпляр формы.
 * ************************************************************************
 */
export function subscribeItemRemoved(form: GroupTopicsManager): void {

    // Подписываемся на событие удаления элемента
    form.store.on("item::removed", (data) => {

        // Пейлоад типизирован как unknown: работаем только с записью темы
        if (!isGroupTopicRecord(data)) return;

        // Если удалили последнюю тему — показываем пустое состояние
        updateEmptyState(form);

    });

}
