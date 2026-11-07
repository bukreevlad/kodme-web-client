// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isSecretChatMessageRecord } from "../../types.js";
import type { SecretChat } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления сообщения из Store.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Store либо null.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: SecretChat): (() => void) | null {

    // Если форма не открыта
    if (!form) return null;

    try {

        // Подписываемся на событие удаления элемента из Store.
        // Возвращаемую отписку сохраняем на форме — иначе после закрытия чата
        // подписка продолжала жить и держала форму в памяти.
        return form.store.on("item::removed", (data) => {

            if (!isSecretChatMessageRecord(data)) return;

            // Гасим точечные подписки компонента строки (item::updated::<id>):
            // без этого подписка держала бы удалённую строку в памяти
            data.__unsubscribeStore__?.();
            delete data.__unsubscribeStore__;

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
