// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeStoreEvents - Подписка формы конференции на события хранилища
 *                        участников.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: MeetPlay): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
