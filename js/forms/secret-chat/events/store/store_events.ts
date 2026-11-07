// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { SecretChat } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка формы на события Store (добавление/удаление сообщений). Все
 * отписки складываются в массив на форме и гасятся в `_onBeforeClose()`.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: SecretChat): void {

    // Если форма не открыта
    if (!form) return;

    form.storeUnsubs = [
        subscribeItemAdded(form),
        subscribeItemRemoved(form)
    ].filter((unsub): unsub is () => void => typeof unsub === "function");

}

/**
 * ***************************************************************************
 * Отписка формы от всех событий Store.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function unsubscribeStoreEvents(form: SecretChat): void {

    // Нет формы — нечего отписывать
    if (!form) return;

    // Вызываем все сохранённые отписки (ошибки не должны мешать закрытию)
    for (const unsubscribe of form.storeUnsubs || []) {
        try {
            unsubscribe();
        } catch (error) {
            Logger.error("[app][events][store-events]::destroy", error);
        }
    }

    // Чистим массив, чтобы повторный вызов был безопасен
    form.storeUnsubs = [];

}
