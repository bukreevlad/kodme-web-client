// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isChannelRecord } from "../../types.js";
import type { Main } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на удаление канала из стора: снимаются все DOM-копии строки
 * (общая папка + папки пользователя).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Main): void {

    try {

        // Подписываемся на событие удаление элемента
        form.store.on("item::removed", (data) => {

            // Пейлоад стора типизирован как unknown: копии DOM есть у записи канала
            if (!isChannelRecord(data)) return;

            // Проверяем наличие массива элементов
            const domElements = data.__domElements__;
            if (Array.isArray(domElements)) {
                domElements.forEach(element => {
                    if (element && typeof element.remove === "function") {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${domElements.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
