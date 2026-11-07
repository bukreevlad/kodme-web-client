// Импортируем events
import { subscribeItemAdded } from "./item_added.js";
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { UserSettingDevices } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события хранилища сессий формы (добавление/удаление элемента).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: UserSettingDevices): void {

    subscribeItemAdded(form);
    subscribeItemRemoved(form);

}
