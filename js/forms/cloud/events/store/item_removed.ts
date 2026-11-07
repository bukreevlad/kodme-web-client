// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isCloudItem, isCloudAvailableLink } from "../../types.js";
import type { Cloud } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события удаления элементов из хранилищ формы: убирает
 * отображённые копии элемента и обновляет пустые состояния.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Cloud): void {

    try {

        // Подписываемся на событие удаления элемента
        form.store.on("item::removed", (data) => {
            _removeDomElements(data);

            // Обновляем пустые состояния
            form._updateEmptyStates();
        });

        // Подписываемся на событие удаления доступной ссылки
        form.availableStore.on("item::removed", (data) => {
            _removeDomElements(data);

            // Обновляем пустые состояния
            form._updateEmptyStates();
        });

        // Подписываемся на событие удаления элемента общего доступа
        form.sharedStore.on("item::removed", (data) => {
            _removeDomElements(data);

            // Обновляем пустые состояния
            form._updateEmptyStates();
        });

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Удаление всех DOM-копий элемента из списков.
 * @param payload - Полезная нагрузка события удаления.
 * ***************************************************************************
 */
function _removeDomElements(payload: unknown): void {

    // Стор шлёт payload как unknown — сверяемся guard'ом
    let record = isCloudItem(payload) || isCloudAvailableLink(payload) ? payload : null;

    // Проверяем наличие массива элементов
    let elements = record?.__domElements__;
    if (elements && Array.isArray(elements)) {
        elements.forEach(element => {
            if (element && typeof element.remove === "function") {
                element.remove();
            }
        });
        Logger.debug(`Успешно удалено копий элемента: ${elements.length}`);

        // Очищаем массив, чтобы не копить утечки памяти
        if (record) record.__domElements__ = [];
    }

}
