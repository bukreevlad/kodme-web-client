// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Main } from "../../../../main/index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем db
import { channelsTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * Нагрузка ws-события отметки «прочитано» участником.
 */
interface ParticipantViewedPayload {

    /** Id канала. */
    channel_id: string;

    /** Id прочитанного участником сообщения. */
    message_id: string;

}

/**
 * Значение — нагрузка отметки «прочитано» участником.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isParticipantViewedPayload(value: unknown): value is ParticipantViewedPayload {
    return isRecord(value) && typeof value.channel_id === "string" && typeof value.message_id === "string";
}

/**
 * ***************************************************************************
 * Подписка на отметку «прочитано» собеседником: обновляется крайнее
 * просмотренное сообщение в локальной БД и сайдбаре, а открытый диалог
 * перерисовывает статусы прочтения своих сообщений.
 * ***************************************************************************
 */
export function subscribeUpdateParticipantViewedMessage(): void {

    // ***************************************************************************
    // Обновление просмотренного сообщения участником
    // ***************************************************************************
    Socket.client.on("[channel-member]: update participant viewed message", (data) => {
        Logger.debug("[app][ws]::[channel-member]: update participant viewed message", data);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isParticipantViewedPayload(data)) return;

                // Получаем из IndexedDB
                const channelIndexedDB = await channelsTable().get(data.channel_id);

                // Обновляем данные (записи может не быть — событие могло
                // прийти раньше загрузки канала, как в update_last_viewed_message)
                if (channelIndexedDB) {
                    channelIndexedDB.display_last_viewed_message_id = data.message_id;
                    await channelsTable().put(channelIndexedDB);
                }

                // =====================================

                // Получаем канал из Store
                const channelStore = Main.instance?.store.get(data.channel_id);

                // Обновляем данные
                if (channelStore) {
                    channelStore.display_last_viewed_message_id = data.message_id;
                    Main.instance?.store.update(data.channel_id, channelStore);
                }

                // =====================================

                // Получаем все сообщения из Store
                const messageForm = Messages.instances.get(data.channel_id);
                if (messageForm) {

                    // Все сообщения
                    const messages = messageForm.store.getAll();
                    if (messages) {
                        messages.forEach(message => {

                            // У системных сообщений такого метода нет —
                            // звонки сыплют их десятками, и одна пропущенная
                            // проверка сыпала бы ошибкой весь обход
                            if (typeof message?.__updateStatusRead__ !== "function") return;

                            message.__updateStatusRead__();
                        });
                    }

                }

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
