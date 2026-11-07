// Импортируем components
import { createSessionItem } from "../../components/session.js";

// Импортируем типы
import { isMenuSessionItem } from "../../types.js";
import type { Menu } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления сессии в список меню.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemAdded(form: Menu): void {

    // Подписываемся на событие добавления нового элемента.
    // Стор локальный (живёт вместе с формой), утечки подписки нет
    form.store.on("item::added", (data) => {

        // Эмитим всегда, но payload может быть не записью
        if (!isMenuSessionItem(data)) return;

        // Создаем DOM-элемент
        const item = createSessionItem(form, data);
        if (item) form.list?.appendChild(item);

    });

}
