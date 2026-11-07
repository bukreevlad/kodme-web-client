// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";
import { GroupTopics } from "../../../../group-topics/index.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, messagesTable, pendingMessagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * Нагрузка удаления канала: id самого канала либо id родителя (для тем).
 */
interface ChannelRemovePayload {

    /** Id удалённого канала. */
    id?: string;

    /** Id родительской группы (приходит вместо id, когда удаляется тема). */
    channel_id?: string;

}

/**
 * Значение — нагрузка удаления канала (id канала либо его группы).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isChannelRemovePayload(value: unknown): value is ChannelRemovePayload {
    return isRecord(value) && (typeof value.id === "string" || typeof value.channel_id === "string");
}

/**
 * ***************************************************************************
 * Подписка на удаление канала у пользователя: канал и его темы вычищаются
 * из локальной БД вместе с сообщениями, из сайдбара и открытых форм.
 * ***************************************************************************
 */
export function subscribeChannelsRemove(): void {

    // ***************************************************************************
    // Удаление канала
    // ***************************************************************************
    Socket.client.on("[channel]: remove", (data, timestamp) => {
        Logger.debug("[app][ws]::[channel]: remove", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: чистим только по id сущности
                if (!isChannelRemovePayload(data)) return;

                // Запоминаем параметры
                const entityId = data.id || data.channel_id;
                if (!entityId) return;

                // Собираем все ID, которые нужно вычистить (канал + темы)
                const idsToRemove = [entityId];

                // Проверяем наличие сущности в IndexedDB
                const entity = await channelsTable().get(entityId);
                if (entity) {

                    // Если это группа — ищем темы
                    const childTopics = await channelsTable()
                        .where("topic_for_group_id")
                        .equals(entityId)
                        .toArray();

                    if (childTopics.length > 0) {
                        childTopics.forEach(topic => idsToRemove.push(topic.id));
                    }

                }

                // Массовая очистка сообщений (для всех найденных id)
                for (const id of idsToRemove) {

                    // Удаляем основные сообщения
                    const msgKeys = await messagesTable()
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();
                    if (msgKeys.length > 0) await messagesTable().bulkDelete(msgKeys);

                    // Удаляем временные сообщения
                    const pendingKeys = await pendingMessagesTable()
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();
                    if (pendingKeys.length > 0) await pendingMessagesTable().bulkDelete(pendingKeys);

                    // Если открыта форма сообщений для этого ID — чистим её Store
                    const messageForm = Messages.instances.get(id);
                    if (messageForm) {
                        if (messageForm.store) messageForm.store.removeAll();
                        messageForm.modal?.close();
                    }

                }

                // Удаление каналов из бд
                await channelsTable().bulkDelete(idsToRemove);

                // Очистка ui (сайдбар и формы тем)
                // Main-инстанс создаётся при старте приложения — без него
                // чистить нечего
                const main = Main.instance;
                if (!main) return;

                idsToRemove.forEach(id => {

                    // Удаляем из главного стора (сайдбар)
                    main.store.remove(id);

                    // Если это была открытая форма топиков
                    const groupTopicsForm = GroupTopics.instances.get(id);
                    if (groupTopicsForm) {
                        if (groupTopicsForm.store) groupTopicsForm.store.removeAll();
                        groupTopicsForm.modal?.close();
                    }

                });

                // Если удаленный объект сам был темой, уведомляем форму родительской группы
                if (entity?.topic_for_group_id) {
                    const parentGroupForm = GroupTopics.instances.get(entity.topic_for_group_id);
                    if (parentGroupForm) {
                        parentGroupForm.store.remove(entityId);
                    }
                }

                Logger.debug(`[app][ws][channel:remove]: Полная зачистка завершена для ${idsToRemove.length} сущностей`);

            } catch (error) {
                Logger.error(error);

                // Если ошибка была вызвана IndexedDB
                if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
                    Toast.error(window._lc.forms.main.toasts.storage_write_failed);
                }
            }

        });

    });

}
