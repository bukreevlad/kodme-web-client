// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createMessageItem } from "../../components/message.js";

// Импортируем типы
import { isOnlineChatMessage } from "../../types.js";
import type { BroadcastOnlineChat } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления сообщения в UI: создаёт строку и добавляет
 * её в конец списка.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: BroadcastOnlineChat): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isOnlineChatMessage(data)) return;

            // Создаем DOM-элемент
            let item = createMessageItem(data);

            // Добавляем в список
            form.list?.appendChild(item);

            // Прокручиваем к сообщению
            item.scrollIntoView({ block: "center", inline: "nearest" });

        });

    } catch (error) {
        Logger.error(error);
    }

}
