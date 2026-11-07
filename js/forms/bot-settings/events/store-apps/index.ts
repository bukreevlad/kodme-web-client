// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { BotSettings } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка формы на события хранилища приложений бота.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: BotSettings): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
