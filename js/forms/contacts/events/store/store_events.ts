// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Contacts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы контактов на события добавления и удаления элементов.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeStoreEvents(form: Contacts): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
