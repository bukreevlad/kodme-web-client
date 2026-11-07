// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { Main } from "../../index.js";

/**
 * ***************************************************************************
 * STORE_EVENTS - подписки стора главной формы.
 * ***************************************************************************
 */
export class StoreEvents {

    /**
     * ***************************************************************************
     * Подписаться на события добавления и удаления каналов.
     * @param form - Экземпляр формы.
     * ***************************************************************************
     */
    static init(form: Main): void {

        subscribeItemAdded(form);
        subscribeItemRemoved(form);

    }

}
