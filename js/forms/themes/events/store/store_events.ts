// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Themes } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы тем на события добавления и удаления элементов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: Themes): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
