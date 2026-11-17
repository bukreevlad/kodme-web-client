// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { ChannelMembers } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы участников на события добавления и удаления.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: ChannelMembers): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
