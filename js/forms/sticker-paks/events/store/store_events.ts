// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { StickerPaks } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы паков на события добавления и удаления элементов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: StickerPaks): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
