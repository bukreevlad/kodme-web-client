// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { BotAppsList } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора диалога приложений на события добавления и удаления
 * элементов.
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: BotAppsList): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
