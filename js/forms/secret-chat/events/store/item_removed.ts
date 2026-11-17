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

            // Обязательно отключаем Observer, чтобы не вызвать лишних
            // срабатываний (DOM-копии и подписки стор снимет сам после события)
            form.store.getDomElements(data.id).forEach(element => {
                form.observer?.unobserve(element);
            });

            // Удаление сообщения могло оставить "сиротские" разделители:
            // планируем пересборку окна (разделители + маркер + якорь)
            form._scheduleListSync?.();

        });

    } catch (error) {
        Logger.error("[app][events][item::removed]:", error);
        return null;
    }

}
