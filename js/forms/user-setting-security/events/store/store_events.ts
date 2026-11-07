// Импортируем events
import { subscribeItemRemoved } from "./item_removed.js";

// Импортируем типы
import type { UserSettingSecurity } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события хранилища ключей формы (удаление элемента).
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export function subscribeStoreEvents(form: UserSettingSecurity): void {

    subscribeItemRemoved(form);

}
