// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createChatBackgroundItem } from "../../components/background.js";

// Импортируем типы
import type { UserSettingDecorations } from "../../index.js";
import type { ChatBackgroundData } from "../../types.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления элемента в хранилище фонов: создаёт DOM-узел
 * фона и вставляет его в конец списка.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: UserSettingDecorations): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on("item::added", (payload) => {

            // invariant: в хранилище добавляются только фоны чатов { id }
            const data = payload as ChatBackgroundData;

            // Создаем DOM-элемент
            const item = createChatBackgroundItem(form, data);

            // Вставляем в конец
            form.backgroundList?.append(item);

        });

    } catch (error) {
        Logger.error(error)
    }

}
