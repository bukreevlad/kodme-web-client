// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

// Импортируем типы
import type { BroadcastOnlineChat } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы онлайн-чата на событие добавления сообщений.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: BroadcastOnlineChat): void {

    subscribeItemAdded(form);

}
