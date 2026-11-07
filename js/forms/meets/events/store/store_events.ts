// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Meets } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы конференций на события добавления и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: Meets): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
