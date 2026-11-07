// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { BroadcastManageInvites } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы приглашений на события добавления и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: BroadcastManageInvites): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
