// Импортируем сторонние пакеты
import { v7 as uuidv7 } from "uuid";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем requests
import { getUpdatesRequest } from "../requests/get_updates.js";

// Импортируем db
import { channelsTable, messagesTable, pendingUpdatesTable } from "../db.js";

// Импортируем типы
import { isDeletedUpdate } from "../types.js";
import type { Main } from "../index.js";
import type { ChannelUpdateItem } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Глобальный обработчик обновлений (поканальная PTS-логика).
 *
 * Пакет применяется отказоустойчиво: запись о намерении ложится в БД
 * до применения и удаляется после. Если сервер отдал полный лимит —
 * запускается следующая итерация.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function getUpdates(form: Main): Promise<void> {
    Logger.debug(`[app][GetUpdates]: Старт цикла синхронизации`);

    try {

        // Обрабатываем "зависшие" пакеты (WAL recovery)
        await processPendingUpdates(form);

        // Собираем карту pts по всем каналам
        const localChannels = await channelsTable().toArray();
        const channelsMap = localChannels.map(c => ({
            id: c.id,
            pts: c.last_pts || 0
        }));

        // Если список каналов пуст
        if (channelsMap.length === 0) {
            Logger.debug(`[app][GetUpdates]: Список каналов пуст, синхронизация не требуется.`);
            return;
        }

        Logger.debug(`[app][GetUpdates]: Запрос обновлений для ${channelsMap.length} каналов.`);

        // Запрос на сервер (передаем массив объектов вместо одного числа)
        const response = await getUpdatesRequest({
            channels: channelsMap,
            offset: 50
        });

        // Если есть данные
        if (response.status && response.data) {

            // Устанавливаем параметры
            const { items, has_more } = response.data;

            // Если есть данные
            if (items && items.length > 0) {
                Logger.debug(`[app][GetUpdates]: Получено ${items.length} обновлений.`);

                // Создаем запись о намерении применить пакет (для отказоустойчивости)
                const pendingId = uuidv7();
                await pendingUpdatesTable().put({
                    id: pendingId,
                    data: items,
                    timestamp: Date.now()
                });

                // Применяем обновления и обновляем pts каналов
                await applyUpdates(form, items);

                // Удаляем запись о намерении после успешного применения
                await pendingUpdatesTable().delete(pendingId);

            } else {
                Logger.debug(`[app][GetUpdates]: Новых сообщений во всех каналах нет.`);
            }

            // Рекурсия (если сервер отдал полный лимит — возможно, есть еще данные)
            if (has_more) {
                Logger.debug(`[app][GetUpdates]: Есть еще данные, запуск следующей итерации...`);
                await getUpdates(form);
                return;
            }
        }

        Logger.debug(`[app][GetUpdates]: Синхронизация успешно завершена`);

    } catch (error) {
        Logger.error(`[app][GetUpdates]: Критическая ошибка:`, error);
        if (getErrorName(error) === "QuotaExceededError") {
            Toast.error(t("forms.main.toasts.storage_overflow"));
        }
    }
}

/**
 * ***************************************************************************
 * Применение обновлений и актуализация PTS для каждого канала.
 * @param form - Экземпляр формы.
 * @param updates - Пакет обновлений (новые/изменённые и удалённые сообщения).
 * ***************************************************************************
 */
async function applyUpdates(form: Main, updates: ChannelUpdateItem[]): Promise<void> {

    // Группируем обновления по каналам, чтобы знать, какой последний PTS выставить каждому
    const channelLatestPts: Record<string, number> = {};

    // Проходим по обновлениям
    for (const item of updates) {
        try {

            // Запоминаем максимальный PTS для конкретного канала из этой пачки
            // (у части обновлений pts нет — тогда канал не трогаем)
            const latestPts = channelLatestPts[item.channel_id];
            if (item.pts != null && (!latestPts || item.pts > latestPts)) {
                channelLatestPts[item.channel_id] = item.pts;
            }

            // Если удалено
            if (isDeletedUpdate(item)) {
                Logger.debug(`[app][GetUpdates]: [DELETE] Сообщение ${item.id} (Канал: ${item.channel_id})`);
                await messagesTable().delete(item.id);

                // Если форма этого канала открыта - удаляем из UI
                const activeForm = Messages.instances.get(item.channel_id);
                if (activeForm) activeForm.store.remove(item.id);

                // Если новое или обновлено (guard сузил до MessageRecord-части)
            } else {
                Logger.debug(`[app][GetUpdates]: [NEW/UPDATE] Сообщение ${item.id} (Канал: ${item.channel_id}, PTS: ${item.pts})`);

                // Сохраняем сообщение в локальную БД
                await messagesTable().put(item);

                // Обновляем ui (списки каналов и превью)
                // При условии если это новое сообщение
                const channelInStore = form.store.get(item.channel_id);
                if (channelInStore) {

                    // Проверяем: это новое сообщение или редактирование текущего последнего?
                    const isNewMessage = !channelInStore.last_message_id || item.id > channelInStore.last_message_id;
                    const isEditOfLast = item.id === channelInStore.last_message_id;

                    if (isNewMessage || isEditOfLast) {

                        // Обновляем превью только если сообщение новее текущего
                        // или если отредактировали то, которое и так было последним
                        form.store.update(item.channel_id, {
                            ...channelInStore,
                            last_message: item,
                            last_message_id: item.id,
                            last_pts: item.pts // Обновляем PTS в любом случае
                        });

                    } else {

                        // Это редактирование старого сообщения (глубоко в истории).
                        // Мы просто фиксируем новый PTS, чтобы синхронизация шла дальше,
                        // но превью чата в списке не меняем.
                        form.store.update(item.channel_id, {
                            ...channelInStore,
                            last_pts: item.pts
                        });
                        Logger.debug(`[sync]: Отредактировано старое сообщение. Превью не меняем.`);

                    }

                }
            }
        } catch (err) {
            Logger.error(`[app][GetUpdates]: Ошибка обработки элемента ${item.id}:`, err);
        }
    }

    // Финальный шаг: записываем новые pts в таблицу каналов
    // Это гарантирует, что следующий GetUpdates уйдет с правильными точками отсчета
    for (const [channelId, newPts] of Object.entries(channelLatestPts)) {
        await channelsTable().update(channelId, { last_pts: newPts });
        Logger.debug(`[app][GetUpdates]: PTS канала ${channelId} обновлен в БД до ${newPts}`);
    }

}

/**
 * ***************************************************************************
 * Восстановление при сбое: применение незавершённых пакетов обновлений.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
async function processPendingUpdates(form: Main): Promise<void> {
    try {

        // Получаем отложенные обновления
        const pendingList = await pendingUpdatesTable().toArray();
        if (pendingList.length === 0) return;

        Logger.warn(`[app][GetUpdates]: [PendingUpdates] Найдено ${pendingList.length} пакетов.`);

        // Проходим и применяем обновления
        for (const pkg of pendingList) {
            await applyUpdates(form, pkg.data);
            await pendingUpdatesTable().delete(pkg.id);
        }

    } catch (e) {
        Logger.error(`[app][GetUpdates]: [PendingUpdates] Ошибка:`, e);
    }
}
