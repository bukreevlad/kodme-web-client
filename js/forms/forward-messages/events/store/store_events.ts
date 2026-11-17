// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

// Импортируем типы
import type { ForwardMessages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписки стора формы пересылки на события добавления и удаления записей.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: ForwardMessages): void {

    // DOM-копии и подписки строк стор снимает сам при удалении элементов
    subscribeItemAdded(form);

}
