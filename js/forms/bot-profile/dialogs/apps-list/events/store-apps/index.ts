// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

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

    // DOM-копии строк стор снимает сам при удалении элементов
    subscribeItemAdded(form);

}
