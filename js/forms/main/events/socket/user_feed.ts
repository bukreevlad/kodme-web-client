// Импортируем config
import { Socket } from "../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../utils/helpers/async_queue.js";

// Импортируем functions
import { applyUserFeedEvent } from "../../functions/apply_user_feed_event.js";

// Импортируем типы
import { isRecord } from "../../types.js";
import type { UserFeedEvent, UserFeedEventType } from "../../../../types/domain.js";

/** Типы событий личной ленты, которые умеет применять диспетчер. */
const USER_FEED_TYPES: Readonly<Record<UserFeedEventType, true>> = {
    channel_created: true,
    channel_removed: true,
    user_updated: true,
    folder_created: true,
    folder_removed: true,
    channel_moved_to_folder: true,
    channel_removed_from_folder: true
};

/**
 * ***************************************************************************
 * Разобрать нагрузку живого толчка в событие личной ленты.
 * @param value - Нагрузка события `[user]: feed`.
 * @returns Событие личной ленты либо null, если нагрузка мусорная.
 * ***************************************************************************
 */
function parseUserFeedEvent(value: unknown): UserFeedEvent | null {

    if (!isRecord(value)) return null;
    if (typeof value.type !== "string") return null;
    if (!Object.hasOwn(USER_FEED_TYPES, value.type)) return null;

    // upid приходит числом, но в догонке может быть строкой из json_agg
    const upid = Number(value.upid);
    if (!Number.isInteger(upid) || upid < 0) return null;

    const payload = isRecord(value.payload) ? value.payload : {};
    return {
        upid,
        type: value.type as UserFeedEventType,
        payload
    };

}

/**
 * ***************************************************************************
 * Подписаться на живой поток событий личной ленты `[user]: feed`.
 *
 * События применяются в строгом порядке через общую очередь, чтобы не
 * потерять гонки (тот же порядок, что у догонки).
 * ***************************************************************************
 */
export function subscribeUserFeed(): void {

    // Очередь выполнения событий личной ленты
    const asyncQueue = new AsyncQueue();

    Socket.client.on("[user]: feed", (payload) => {

        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с событием
                const event = parseUserFeedEvent(payload);
                if (!event) return;

                await applyUserFeedEvent(event, true);

            } catch (error) {
                Logger.error("[app][user-feed]: ошибка применения события:", error);
            }

        });

    });

}
