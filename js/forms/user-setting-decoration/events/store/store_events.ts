// Импортируем events
import { subscribeItemAdded } from "./item_added.js";

// Импортируем типы
import type { UserSettingDecorations } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события хранилища фонов формы (добавление/удаление элемента).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: UserSettingDecorations): void {

    // DOM-копии строк стор снимает сам при удалении элементов
    subscribeItemAdded(form);

}
