// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isMenuSessionItem } from "../../types.js";
import type { Menu } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления сессии: убирает отображённые копии строки
 * списка меню (по ссылкам из `__domElements__`).
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemRemoved(form: Menu): void {

    // Подписываемся на событие удаление элемента
    form.store.on("item::removed", (data) => {

        // Эмитим всегда, но payload может быть не записью
        if (!isMenuSessionItem(data)) return;

        // Проверяем наличие массива элементов
        const elements = data.__domElements__;
        if (elements && Array.isArray(elements)) {
            elements.forEach(element => {
                if (element && typeof element.remove === "function") {
                    element.remove();
                }
            });
            Logger.debug(`Успешно удалено копий элемента: ${elements.length}`);

            // Очищаем массив, чтобы не копить утечки памяти
            data.__domElements__ = [];
        }

    });

}
