// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isMessageRecord } from "../../types.js";
import type { Messages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления сообщения из Store.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Store либо null.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Messages): (() => void) | null {

    // Если форма не открыта
    if (!form) return null;

    try {

        // Подписываемся на событие удаления элемента из Store.
        // Возвращаемую отписку сохраняем на форме — иначе после закрытия чата
        // подписка продолжала жить и держала форму в памяти.
        return form.store.on("item::removed", (data) => {

            if (!isMessageRecord(data)) return;

            // Удаляем id из набора исходящих сообщений, если он там был
            form.pendingIds?.delete(data.id);

            // Проверяем наличие массива элементов
            if (data.__domElements__ && Array.isArray(data.__domElements__)) {
                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === "function") {

                        // Обязательно отключаем Observer, чтобы не вызвать лишних срабатываний
                        form.observer?.unobserve(element);

                        // Удаляем элемент
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${data.__domElements__.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];
            }

            // Удаление сообщения могло оставить "сиротские" разделители:
            // планируем пересборку окна (разделители + маркер + якорь)
            form._scheduleListSync?.();

        });

    } catch (error) {
        Logger.error("[app][events][item::removed]:", error);
        return null;
    }

}
