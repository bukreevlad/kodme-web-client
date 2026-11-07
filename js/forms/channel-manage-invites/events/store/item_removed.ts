// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем типы
import { isChannelInvite } from "../../types.js";
import type { ChannelManageInvites } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления приглашения: убирает отображённые копии
 * строки списка и, если список опустел, показывает пустое состояние.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: ChannelManageInvites): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            const record = isChannelInvite(data) ? data : null;
            const elements = record?.__domElements__;

            // Проверяем наличие массива элементов
            if (elements && Array.isArray(elements)) {
                elements.forEach(element => {
                    if (element && typeof element.remove === "function") {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${elements.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                record.__domElements__ = [];
            }

            // Если удалили последнее приглашение — показываем пустое состояние
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
