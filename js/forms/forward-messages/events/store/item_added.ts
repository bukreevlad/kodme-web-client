// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createChannelItem } from "../../components/channel.js";

// Импортируем типы
import { isForwardChannel } from "../../types.js";
import type { ForwardMessages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления канала в UI: строки вставляются в конец
 * списка (стор отдаёт страницу в порядке возрастания id).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: ForwardMessages): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data) => {

            // Эмитим всегда, но payload может быть не каналом
            if (!isForwardChannel(data)) return;

            // Если пользователь не участник
            if (data.is_member === false) return;

            // Создаем DOM-элемент
            const item = createChannelItem(form, data);

            // Добавляем в список
            form.list?.appendChild(item.element);

        });

    } catch (error) {
        Logger.error(error);
    }

}
