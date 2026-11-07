// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { MeetManageInvites } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы приглашений конференции на события добавления
 * и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: MeetManageInvites): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
