// Импортируем config
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Main } from "../../../../main/index.js";

// Импортируем db
import { channelsTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * Нагрузка ws-события обновления просмотренного сообщения.
 */
interface ViewedMessagePayload {

    /** Id канала. */
    channel_id: string;

    /** Id просмотренного сообщения. */
    message_id: string;

}

/**
 * Значение — нагрузка обновления просмотренного сообщения.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isViewedMessagePayload(value: unknown): value is ViewedMessagePayload {
    return isRecord(value) && typeof value.channel_id === "string" && typeof value.message_id === "string";
}

/**
 * ***************************************************************************
 * Подписка на отметку «прочитано» у самого пользователя: запоминается
 * просмотренное сообщение — в локальной БД и в сайдбаре.
 * ***************************************************************************
 */
export function subscribeUpdateLastViewedMessage(): void {

    // ***************************************************************************
    // Обновление просмотренного сообщения
    // ***************************************************************************
    Socket.client.on("[channel-member]: update last viewed message", (data) => {
        Logger.debug("[app][ws]::[channel-member]: update last viewed message", data);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isViewedMessagePayload(data)) return;

                // Патчим отметку (записи может не быть — событие могло прийти
                // раньше загрузки канала; удалённый канал не «воскресает»)
                await channelsTable().update(data.channel_id, { last_read_id: data.message_id });

                // =====================================

                // Получаем канал из Store
                const channelStore = FormsRegistry.getOwner<Main>("main")?.store.get(data.channel_id);

                // Обновляем данные
                if (channelStore) {
                    channelStore.last_read_id = data.message_id;
                    FormsRegistry.getOwner<Main>("main")?.store.update(data.channel_id, channelStore);
                }

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
