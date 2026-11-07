// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Menu } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы меню на события добавления и удаления элементов.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeStoreEvents(form: Menu): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
