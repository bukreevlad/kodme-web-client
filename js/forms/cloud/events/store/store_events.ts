// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Cloud } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы облака на события добавления и удаления элементов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: Cloud): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
