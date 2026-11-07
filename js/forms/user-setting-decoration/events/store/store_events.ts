// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { UserSettingDecorations } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события хранилища фонов формы (добавление/удаление элемента).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: UserSettingDecorations): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
