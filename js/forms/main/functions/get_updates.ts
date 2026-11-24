// Импортируем сторонние пакеты

// Импортируем utils
import { v7 as uuidv7 } from "uuid";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";
import { isChannelUnavailable } from "../../../utils/helpers/channel_unavailable.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUpdatesRequest } from "../requests/get_updates.js";
import { getChannelInfoRequest } from "../../channel-profile/requests/get_channel_info.js";

// Импортируем functions
import { applyChannelFeedEvent } from "./apply_feed_event.js";

// Импортируем events (апплайеры событий к локальным хранилищам и UI)
import { applyChannelRemove } from "../events/socket/channels/remove.js";

// Импортируем db
import { channelsTable, messagesTable, pendingUpdatesTable } from "../db.js";

// Импортируем типы
import { isChannelRecord } from "../types.js";
import type { ChannelFeedEvent } from "../../../types/domain.js";
import type { ChannelRecord } from "../types.js";
import type { Main } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Глобальный обработчик догоняющих обновлений (лента событий канала).
 *
 * Сервер отдаёт события ленты того же формата, что и живой толчок
 * `[channel]: feed`, и они применяются тем же аплайером. Пакет применяется
 * отказоустойчиво: запись о намерении ложится в БД до применения и удаляется
 * после. Если сервер отдал полный лимит — запускается следующая итерация.
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
            const { items, has_more, too_long } = response.data;

            // Каналы с отрезанной точкой перечитываем целиком
            if (too_long && too_long.length > 0) {
                for (const channelId of too_long) {
                    await refreshChannelSnapshot(form, channelId);
                }
            }

            // Если есть данные
            let applied = 0;
            if (items && items.length > 0) {
                Logger.debug(`[app][GetUpdates]: Получено ${items.length} событий.`);

                // Создаем запись о намерении применить пакет (для отказоустойчивости)
                const pendingId = uuidv7();
                await pendingUpdatesTable().put({
                    id: pendingId,
                    data: items,
                    timestamp: Date.now()
                });

                // Применяем события (единый аплайер с живым толчком)
                applied = await applyUpdates(items);

                // Удаляем запись о намерении после успешного применения
                await pendingUpdatesTable().delete(pendingId);

            } else {
                Logger.debug(`[app][GetUpdates]: Новых событий во всех каналах нет.`);
            }

            // Рекурсия (если сервер отдал полный лимит — возможно, есть еще данные)
            if (has_more) {

                // Все события пакета упали — pts каналов не продвинулся, и
                // рекурсия запросит те же строки: выходим, догонка повторится
                // при следующей синхронизации
                if (items && items.length > 0 && applied === 0) {
                    Logger.warn(`[app][GetUpdates]: ни одно из ${items.length} событий не применилось — выход из цикла`);
                    return;
                }

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
 * Применить пакет событий ленты (каждое — через общий аплайер).
 * @param events - Пакет событий ленты (в порядке возрастания pts).
 * @returns Сколько событий обработано без ошибки (0 — пакет упал целиком).
 * ***************************************************************************
 */
async function applyUpdates(events: ChannelFeedEvent[]): Promise<number> {

    // Счётчик обработанных: сбой одного события не должен ронять остальные
    let applied = 0;

    for (const event of events) {
        try {
            await applyChannelFeedEvent(event, false);
            applied++;
        } catch (err) {
            Logger.error(`[app][GetUpdates]: Ошибка обработки события ${event.type} (Канал: ${event.channel_id}):`, err);
        }
    }

    return applied;

}

/**
 * ***************************************************************************
 * Перечитать канал целиком (снапшот после too_long).
 *
 * Точка отрезана лентой — локальная история устарела, поэтому она чистится:
 * форма перечитает историю при открытии. Если канала больше нет (или
 * доступ закрыт) — ленивое обнаружение: канал убирается из хранилищ.
 * @param form - Экземпляр формы.
 * @param channelId - Id канала.
 * ***************************************************************************
 */
async function refreshChannelSnapshot(form: Main, channelId: string): Promise<void> {

    try {

        // Данные канала (запрос привязан к пользователю: права, непрочитанные, pts)
        const response = await getChannelInfoRequest({ channel_id: channelId });
        if (!response.status || !isChannelRecord(response.data)) return;

        // Кладём канал в локальные хранилища
        const channel: ChannelRecord = response.data;
        await channelsTable().put(channel);
        form.store.update(channelId, channel);

        // Чистим устаревшую историю канала
        await messagesTable().where("channel_id").equals(channelId).delete();
        Logger.debug(`[app][GetUpdates]: [SNAPSHOT] Канал ${channelId} перечитан, история очищена`);

    } catch (error) {
        Logger.error(`[app][GetUpdates]: [SNAPSHOT] Канал ${channelId} не перечитан:`, error);

        // Ленивое обнаружение: канала нет или доступ закрыт — убираем его
        if (isChannelUnavailable(error)) await applyChannelRemove({ channel_id: channelId });
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
            await applyUpdates(pkg.data);
            await pendingUpdatesTable().delete(pkg.id);
        }

    } catch (e) {
        Logger.error(`[app][GetUpdates]: [PendingUpdates] Ошибка:`, e);
    }
}
