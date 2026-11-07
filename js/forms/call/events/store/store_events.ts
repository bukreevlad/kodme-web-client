// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка формы звонка на события хранилища участников.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: Call): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
