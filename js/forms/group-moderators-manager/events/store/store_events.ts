// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { GroupModeratorsManager } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки на стор формы менеджера модераторов (все подписки локальные —
 * живут вместе с формой и не требуют явной отписки).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: GroupModeratorsManager): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
