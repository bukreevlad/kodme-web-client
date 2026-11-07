// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { ForwardMessages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы пересылки на события добавления и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: ForwardMessages): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
