// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";
import { subscribeChannelItemUpdated } from "./channel_item_updated.js";

// Импортируем типы
import type { GroupTopics } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки на стор для формы тем группы.
 * @param form - Экземпляр формы.
 * @returns Отписки от глобального стора (вызываются при закрытии формы).
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: GroupTopics): Array<() => void> {

    // Локальные подписки формы уходят вместе с её хранилищем — отписывать
    // нечего; глобальный стор требует явной отписки
    subscribeItemAdded(form);
    subscribeItemRemoved(form);

    // Подписка на глобальный стор живёт вне формы — сохраняем отписку.
    // Без стора отписываться нечего, список остаётся пустым
    const unsubscribe = subscribeChannelItemUpdated(form);
    return unsubscribe ? [unsubscribe] : [];

}
