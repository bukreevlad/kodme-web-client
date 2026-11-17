// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isStickerPakItem } from "../../types.js";
import type { StickerPaks } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления пака из UI: обновляет пустое состояние
 * списка (DOM-копии элемента стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: StickerPaks): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isStickerPakItem(data)) return;

            // Показываем/прячем пустое состояние списка (DOM-копии стор снимает сам)
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error("[app][sticker-paks][subscribe-item-removed]:", error);
    }

}
