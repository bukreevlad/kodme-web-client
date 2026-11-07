// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isStickerPakItem } from "../../types.js";
import type { StickerPaks } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка удаления пака из UI: убирает отображённые копии
 * элемента и обновляет пустое состояние списка.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: StickerPaks): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isStickerPakItem(data)) return;

            // Проверяем наличие массива элементов
            if (data.__domElements__ && Array.isArray(data.__domElements__)) {

                // Удаляем отображённые копии элемента
                data.__domElements__.forEach((element) => {

                    try {
                        element.remove();
                    } catch (error) {
                        Logger.error("[app][sticker-paks][item-removed]:", error);
                    }

                });

                // Очищаем массив копий (стор живёт дольше DOM)
                data.__domElements__ = [];

            }

            // Показываем/прячем пустое состояние списка
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error("[app][sticker-paks][subscribe-item-removed]:", error);
    }

}
