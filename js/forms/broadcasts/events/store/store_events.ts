// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Broadcasts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы трансляций на события добавления и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: Broadcasts): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
