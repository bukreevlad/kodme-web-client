// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../../index.js";
import type { ChatBackgroundData } from "../../types.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления элемента из хранилища фонов: удаляет все
 * накопленные DOM-копии элемента.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: UserSettingDecorations): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (payload) => {

            // invariant: из хранилища удаляются только фоны чатов { id }
            const data = payload as ChatBackgroundData;

            // Проверяем наличие массива элементов
            if (data.__domElements__ && Array.isArray(data.__domElements__)) {
                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === 'function') {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${data.__domElements__.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];
            }

        });

    } catch (error) {
        Logger.error(error)
    }

}
