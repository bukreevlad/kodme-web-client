// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { GroupTopics } from "../../../../group-topics/index.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, cleanChannel } from "../../../db.js";

// Импортируем типы
import { isChannelWithTopics } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * ***************************************************************************
 * Подписка на появление канала (или темы) у пользователя.
 *
 * Пришедшая с сервера запись раскладывается: сам канал уходит в локальную
 * БД и сайдбар, а вложенные темы — отдельными записями (дублей в БД
 * не будет: массив topics у канала не сохраняется).
 * ***************************************************************************
 */
export function subscribeChannelsNew(): void {

    // ***************************************************************************
    // Новый канал
    // ***************************************************************************
    Socket.client.on("[channel]: new", (data, timestamp) => {
        Logger.debug("[app][ws]::[channel]: new", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: раскладываем только запись канала
                if (!isChannelWithTopics(data)) return;

                // Извлекаем вложенные темы (если они есть в пришедшем объекте)
                const rawTopics = data.topics || [];

                // Клонируем данные и удаляем массив topics, чтобы не хранить дубли в БД
                const entityData = { ...data };
                delete entityData.topics;

                // Подготавливаем данные для IndexedDB
                const cleanEntity = cleanChannel(entityData);
                await channelsTable().put(cleanEntity);

                // Если в объекте были темы — раскладываем их как отдельные записи
                if (rawTopics.length > 0) {

                    // Проходим по темам
                    for (const topic of rawTopics) {
                        const cleanTopic = cleanChannel(topic);
                        await channelsTable().put(cleanTopic);

                        // Если открыта форма списка тем для этого родителя — пушим туда
                        const groupTopicsForm = GroupTopics.instances.get(entityData.id);
                        if (groupTopicsForm) {

                            // Проверяем топик на существование
                            const hasTopic = groupTopicsForm.store.get(cleanTopic.id);
                            if (hasTopic) {
                                groupTopicsForm.store.update(cleanTopic.id, cleanTopic);
                            } else {
                                groupTopicsForm.store.add(cleanTopic);
                            }

                        }
                    }
                }

                // Если это пришла тема (у неё есть родитель)
                if (cleanEntity.topic_for_group_id) {

                    const groupTopicsForm = GroupTopics.instances.get(cleanEntity.topic_for_group_id);
                    if (groupTopicsForm) {

                        // Обновляем Store
                        const storeChannel = groupTopicsForm.store.get(cleanEntity.id);
                        if (storeChannel) {
                            groupTopicsForm.store.update(cleanEntity.id, cleanEntity);
                        } else {
                            groupTopicsForm.store.add(cleanEntity);
                        }

                    }

                }

                // Если это полноценный чат / канал / группа
                else {

                    // Обновляем Store
                    const storeChannel = Main.instance?.store.get(entityData.id);
                    if (storeChannel) {
                        Main.instance?.store.update(entityData.id, entityData);
                    } else {
                        Main.instance?.store.add(entityData);
                    }

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
