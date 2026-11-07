// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isChannelRecord } from "../../../main/types.js";
import type { GroupTopics } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на удаление элемента из локального хранилища формы: снимает
 * отрисованные копии строки из DOM.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: GroupTopics): void {

    // Подписываемся на событие удаления элемента
    form.store.on("item::removed", (data) => {

        // Пейлоад типизирован как unknown: работаем только с записью канала
        if (!isChannelRecord(data)) return;

        // Проверяем наличие массива отрисованных копий элемента
        if (data.__domElements__ && Array.isArray(data.__domElements__)) {
            data.__domElements__.forEach(element => {
                if (element && typeof element.remove === "function") {
                    element.remove();
                }
            });
            Logger.debug(`Успешно удалено копий элемента: ${data.__domElements__.length}`);

            // Очищаем массив, чтобы не копить утечки памяти
            data.__domElements__ = [];
        }

    });

}
