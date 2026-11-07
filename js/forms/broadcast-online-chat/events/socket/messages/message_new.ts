// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем forms
import { BroadcastOnlineChat } from "../../../../broadcast-online-chat/index.js";

// Импортируем типы
import { isOnlineChatMessage } from "../../../../broadcast-online-chat/types.js";

/**
 * ***************************************************************************
 * Подписка на новое сообщение онлайн-чата: запись добавляется в стор формы,
 * подписка стора создаёт строку в списке.
 * ***************************************************************************
 */
export function subscribeMessageNew(): void {

    // ***************************************************************************
    // Новое сообщение
    // ***************************************************************************
    Socket.client.on(`[message]: new`, async (data, timestamp) => {
        Logger.debug("[app][ws]::[message]: new", data, timestamp);

        try {

            // Получаем instance формы
            let form = BroadcastOnlineChat.instance;
            if (form) {

                // Стор шлёт payload как unknown — сверяемся guard'ом.
                // Опции добавления не нужны: подписчик item::added направление
                // не читает, сообщения всегда идут в конец списка
                if (isOnlineChatMessage(data)) {
                    form.store.add(data);
                }

            }

        } catch (error) {
            Logger.error(error);
        }

    });

}
