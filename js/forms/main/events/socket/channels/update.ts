// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { GroupTopics } from "../../../../group-topics/index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем типы соседней формы (только для передачи канала в неё)
import { isChannelRecord as isMessagesChannelRecord } from "../../../../messages/types.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, cleanChannel } from "../../../db.js";

// Импортируем типы
import { isChannelWithTopics } from "../../../types.js";
import type { ChannelRecord } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * ***************************************************************************
 * Подписка на обновление канала: запись мержится поверх текущей в локальной
 * БД, после чего обновляются сайдбар и открытые формы (диалог, темы).
 * ***************************************************************************
 */
export function subscribeChannelsUpdate(): void {

    // ***************************************************************************
    // Обновление канала
    // ***************************************************************************
    Socket.client.on("[channel]: update", (data, timestamp) => {
        Logger.debug("[app][ws]::[channel]: update", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: мержим только запись канала
                if (!isChannelWithTopics(data)) return;

                // Чистим входящие данные (вырезаем topics, если они там есть)
                const updateData = { ...data };
                delete updateData.topics;

                // Подготавливаем данные для IndexedDB
                const cleanUpdate = cleanChannel(updateData);

                // Получаем текущее состояние из БД
                const currentEntity = await channelsTable().get(data.id);
                if (!currentEntity) return;

                // Смержим данные и сохраним
                const updatedEntity: ChannelRecord = { ...currentEntity, ...cleanUpdate };
                await channelsTable().put(updatedEntity);

                // Обновляем в Main.store, если сущность там есть (каналы/группы)
                if (Main.instance?.store.get(updatedEntity.id)) {
                    Main.instance?.store.update(updatedEntity.id, updatedEntity);
                }

                // Если канал открыт: форма сообщений типизирует канал
                // по-своему (обязательные type и display_name) — сверяем
                // структуру их guard'ом перед передачей
                const messagesForm = Messages.instances.get(updatedEntity.id);
                if (messagesForm && isMessagesChannelRecord(updatedEntity)) {
                    messagesForm._update(updatedEntity);
                }

                // Если это тема группы — обновляем её в GroupTopics
                if (updatedEntity.topic_for_group_id) {
                    const groupTopicsForm = GroupTopics.instances.get(updatedEntity.topic_for_group_id);
                    if (groupTopicsForm) groupTopicsForm.store.update(updatedEntity.id, updatedEntity);
                }

            } catch (error) {
                Logger.error(error);

                // Если ошибка была вызвана IndexedDB
                if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
                    Toast.error(t("forms.main.toasts.storage_write_failed"));
                }
            }

        });

    });

}
