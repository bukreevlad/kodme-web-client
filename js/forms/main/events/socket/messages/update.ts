// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";
import { GroupTopics } from "../../../../group-topics/index.js";

// Импортируем db
import { channelsTable, cleanMessage, messagesTable } from "../../../db.js";

// Импортируем типы
import { isMessageRecord } from "../../../types.js";

/**
 * ***************************************************************************
 * Подписка на обновление сообщения (правка/статусы): запись мержится в
 * локальной БД, обновляется превью последнего сообщения канала (в БД,
 * сайдбаре и списке тем), открытый диалог перерисовывает сообщение.
 * @param asyncQueue - Общая очередь сообщений (см. subscribeMessagesNew).
 * ***************************************************************************
 */
export function subscribeMessagesUpdate(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Обновляем сообщение
    // ***************************************************************************
    Socket.client.on("[message]: update", (data, timestamp) => {
        Logger.debug("[app][ws]::[message]: update", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с записью сообщения
                if (!isMessageRecord(data)) return;

                // Подготавливаем данные для IndexedDB
                const cleanData = cleanMessage(data);
                await messagesTable().put(cleanData);

                // ======================================

                // Получаем канал из IndexedDB
                const channelDB = await channelsTable().get(data.channel_id);
                if (channelDB) {

                    // Обновляем данные (pts приходит строкой — bigint в pg,
                    // стор и типы хранят число)
                    channelDB.last_pts = data.pts !== undefined ? Number(data.pts) : undefined;
                    if (channelDB.last_message_id === data.id) {
                        channelDB.last_message = cleanData;
                    }

                    // Записываем в IndexedDB
                    await channelsTable().put(channelDB);

                    // Если это тема — обновляем превью в списке тем и у родителя
                    if (channelDB.topic_for_group_id) {

                        // Поиск формы GroupTopics
                        const gtForm = GroupTopics.instances.get(channelDB.topic_for_group_id);
                        if (gtForm) gtForm.store.update(channelDB.id, channelDB);

                        // Поиск группы
                        const parentStore = Main.instance?.store.get(channelDB.topic_for_group_id);
                        if (parentStore && parentStore.last_message?.id === data.id) {
                            parentStore.last_message = data;
                            Main.instance?.store.update(parentStore.id, parentStore);
                        }

                    }
                }

                // ======================================

                // Поиск формы
                const form = Messages.instances.get(data.channel_id);
                if (form) {
                    const isMessage = form.store.get(data.id);
                    const isBottom = form.listScrollManager?.isAtBottom();
                    if (isMessage) {
                        form.store.update(data.id, { ...data, is_temporary: false });
                    }

                    // Если скролл был внизу
                    if (isBottom) {
                        form.listScrollManager?.scrollToBottom();
                    }
                }

                // ======================================

                // Обновление канала
                const channelStore = Main.instance?.store.get(data.channel_id);

                // Если канал найден
                if (channelStore && !channelDB?.topic_for_group_id) {
                    if (channelStore.last_message_id === data.id) {
                        channelStore.last_message = data;
                        Main.instance?.store.update(channelStore.id, channelStore);
                    }
                }

            } catch (error) {
                Logger.error(error);
            }

        });
    });
}
