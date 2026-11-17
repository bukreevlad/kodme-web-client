// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isThemeItem } from "../../types.js";
import type { Themes } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления темы из UI: обновляет пустое состояние
 * списка (DOM-копии элемента стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Themes): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isThemeItem(data)) return;

            // Если удалили последнюю тему — показываем пустое состояние
            // (DOM-копии стор снимает сам)
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
