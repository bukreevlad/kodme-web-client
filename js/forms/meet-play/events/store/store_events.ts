// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

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

    // DOM-копии и подписки карточек стор снимает сам при удалении элементов
    subscribeItemAdded(form);

}
