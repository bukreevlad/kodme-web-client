// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { MainFoldersManager } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки на стор формы менеджера папок (все подписки локальные —
 * живут вместе с формой и не требуют явной отписки).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: MainFoldersManager): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}