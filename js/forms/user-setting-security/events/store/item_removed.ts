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
            const record = isPasskeyListItem(data) ? data : null;
            const elements = record?.__domElements__;

            // Проверяем наличие массива элементов
            if (elements && Array.isArray(elements)) {
                elements.forEach(element => {
                    if (element && typeof element.remove === 'function') {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${elements.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                record.__domElements__ = [];
            }

            // Если в списке не осталось ключей — показываем заглушку
            updatePasskeysEmptyState(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
