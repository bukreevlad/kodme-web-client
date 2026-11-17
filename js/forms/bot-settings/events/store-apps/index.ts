// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

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

    // DOM-копии строк стор снимает сам при удалении элементов
    subscribeItemAdded(form);

}
