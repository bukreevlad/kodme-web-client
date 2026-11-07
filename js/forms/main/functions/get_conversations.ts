// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUserConverstionRequest } from "../requests/get_user_converstion.js";
import type { GetUserConverstionData } from "../requests/get_user_converstion.js";

// Импортируем db
import { channelsTable, messagesTable, pendingMessagesTable } from "../db.js";

// Импортируем типы
import type { Main } from "../index.js";
import type { AddPageOptions, ChannelRecord } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Получение списка чатов пользователя и синхронизация их состояния (PTS).
 *
 * Страницы подгружаются, пока сервер отдаёт новые id; локальный PTS
 * канала берётся за основу, если он валиден, иначе сбрасывается на
 * серверный (со стиранием сообщений). Сущности, пропавшие с сервера,
 * удаляются после загрузки всех страниц.
 * @param form - Экземпляр формы (контекст приложения).
 * ***************************************************************************
 */
export async function getConversations(form: Main): Promise<void> {

    try {

        // Получаем текущее состояние всех сущностей (каналов и тем) из локальной БД (один раз в начале)
        const existingEntities = await channelsTable().toArray();
        const existingMap = new Map(existingEntities.map(c => [c.id, c]));

        // Сет для сбора ВСЕХ ID, пришедших с сервера за все страницы (включая темы)
        const serverIds = new Set<string>();

        /**
         * Внутренняя функция для обработки и сохранения сущности (канала или темы)
         * @param item - Канал или тема, пришедшие с сервера.
         * @param parentId - Id родительской группы (заполнен для тем).
         */
        const processEntity = async (item: ChannelRecord, parentId?: string): Promise<void> => {
            try {
                const id = item.id;
                if (!id) return;

                serverIds.add(id);

                // 1. Пытаемся найти локальную версию канала
                const existing = existingMap.get(id);

                // 2. Валидация локального PTS
                const localPts = Number(existing?.last_pts);
                const isValidLocal = !isNaN(localPts) && localPts > 0;

                // 3. Получаем серверный PTS
                const serverPts = Number(item.last_pts ?? item.pts ?? 0);

                let ptsToSave: number;

                if (isValidLocal) {
                    ptsToSave = localPts;
                } else {
                    ptsToSave = serverPts;

                    Logger.warn(`[app][GetUserConverstion]: PTS для канала ${id} поврежден или отсутствует. Сброс на серверный: ${ptsToSave}`);

                    await messagesTable().where("channel_id").equals(id).delete();
                    await pendingMessagesTable().where("channel_id").equals(id).delete();
                }

                // 4. Подготовка объекта: темы и старый PTS не сохраняем,
                // PTS — только валидный (локальный либо серверный)
                const { topics: _topics, last_pts: _oldPts, ...cleanItem } = item;

                const entityToSave: ChannelRecord = {
                    ...cleanItem,
                    last_pts: ptsToSave,
                    ...(parentId && { topic_for_group_id: parentId })
                };

                // 5. Сохранение в IndexedDB
                await channelsTable().put(entityToSave);

                // 6. Синхронизация с UI Store
                const storeItem = form.store.get(id);
                if (storeItem) {
                    form.store.update(id, entityToSave);
                } else {

                    // Направление вставки — переменной (стор пробрасывает его подписчикам)
                    const options: AddPageOptions = { direction: "next" };
                    form.store.add(entityToSave, options);

                }

            } catch (error) {
                Logger.error(`[processEntity] Ошибка при обработке канала/темы ${item?.id}:`, error);
            }
        };

        // Переменные управления пагинацией
        let cursorId: string | undefined = undefined;
        let hasMore = true;

        // Цикл автоподзагрузки страниц
        while (hasMore) {

            // Формируем параметры запроса
            const queryParams: GetUserConverstionData = {
                direction: "next",
                ...(cursorId && { cursor_id: cursorId }),
                offset: 50
            };

            // Делаем запрос на сервер
            const conversations = await getUserConverstionRequest(queryParams);

            // Проверяем наличие данных
            if (conversations.status && Array.isArray(conversations.data) && conversations.data.length > 0) {
                const serverChannels = conversations.data;
                Logger.debug(`[app][GetUserConverstion]: обрабатываем пакет`, serverChannels);

                // Проходим по каналам из полученной порции
                for (const channel of serverChannels) {

                    // invariant: сервер не должен присылать пустые записи, но
                    // payload — недоверенные данные: null в массиве роняет разбор
                    if (!channel) continue;

                    await processEntity(channel);

                    if (channel.type === 2 && Array.isArray(channel.topics)) {
                        for (const topic of channel.topics) {
                            // Тема могла исчезнуть между запросами сервера —
                            // в JSON это null, разбираем только валидные
                            if (!topic) continue;
                            await processEntity(topic, channel.id);
                        }
                    }
                }

                // Получаем ID последнего канала порции для следующего курсора
                const lastChannel = serverChannels[serverChannels.length - 1];
                const nextCursorId = lastChannel?.id;

                // Защита от бесконечного цикла: если cursorId не изменился или пуст — выходим
                if (!nextCursorId || nextCursorId === cursorId) {
                    hasMore = false;
                } else {
                    cursorId = nextCursorId;
                }

            } else {
                // Если данные пустые (пустой массив или null) — останавливаем цикл
                hasMore = false;
            }
        }

        // ВАЖНО: Чистка устаревших сущностей выполняется ПОСЛЕ загрузки всех страниц
        for (const existing of existingEntities) {
            if (!serverIds.has(existing.id)) {
                await channelsTable().delete(existing.id);

                if (existing.type !== 4) {
                    form.store.remove(existing.id);
                }

                Logger.debug(`[app][GetUserConverstion]: Сущность ${existing.id} удалена из системы.`);
            }
        }

    } catch (error) {
        Logger.error("[app][GetUserConverstion]: Ошибка:", error);

        if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
            Toast.error(t("forms.main.toasts.storage_overflow_or_unavailable"));
        }
    }

}
