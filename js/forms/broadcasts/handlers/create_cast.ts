// Импортируем forms
import { BroadcastCreate } from "../../broadcast-create/index.js";

// Импортируем типы
import type { Broadcasts } from "../index.js";

/**
 * ***************************************************************************
 * Открытие формы создания трансляции (кнопка в пустом состоянии списка).
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function createCastHandler(form: Broadcasts): void {

    // Открываем форму создания
    new BroadcastCreate();

}
