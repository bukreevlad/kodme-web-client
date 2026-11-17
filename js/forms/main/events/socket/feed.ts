// Импортируем config
import { Socket } from "../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../utils/helpers/async_queue.js";

// Импортируем functions
import { applyChannelFeedEvent } from "../../functions/apply_feed_event.js";

// Импортируем типы
import { isRecord } from "../../types.js";
import type { ChannelFeedEvent, ChannelFeedEventType } from "../../../../types/domain.js";

/** Типы событий ленты, которые умеет применять диспетчер. */
const FEED_TYPES: Readonly<Record<ChannelFeedEventType, true>> = {
    message_new: true,
    message_edit: true,
    message_deleted: true,
    history_cleared: true,
    messages_cleaned: true,
    member_joined: true,
    member_left: true,
    member_banned: true,
    member_unbanned: true,
    channel_created: true,
    channel_removed: true,
    channel_updated: true,
    topic_created: true
};

/**
 * ***************************************************************************
 * Разобрать нагрузку живого толчка в событие ленты.
 * @param value - Нагрузка события `[channel]: feed`.
 * @returns Событие ленты либо null, если нагрузка мусорная.
 * ***************************************************************************
 */
function parseFeedEvent(value: unknown): ChannelFeedEvent | null {

    if (!isRecord(value)) return null;
    if (typeof value.channel_id !== "string" || typeof value.type !== "string") return null;
    if (!Object.hasOwn(FEED_TYPES, value.type)) return null;

    // pts приходит числом, но в догонке может быть строкой из json_agg
    const pts = Number(value.pts);
    if (!Number.isInteger(pts) || pts < 0) return null;

    const payload = isRecord(value.payload) ? value.payload : {};
    return {
        channel_id: value.channel_id,
        type: value.type as ChannelFeedEventType,
        pts,
        payload
    };

}

/**
 * ***************************************************************************
 * Подписаться на живой поток событий ленты `[channel]: feed`.
 *
 * События применяются в строгом порядке через общую очередь, чтобы не
 * потерять гонки (тот же порядок, что у догонки).
 * ***************************************************************************
 */
export function subscribeChannelFeed(): void {

    // Очередь выполнения событий ленты
    const asyncQueue = new AsyncQueue();

    Socket.client.on("[channel]: feed", (payload) => {

        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с событием
                const event = parseFeedEvent(payload);
                if (!event) return;

                await applyChannelFeedEvent(event, true);

            } catch (error) {
                Logger.error("[app][feed]: ошибка применения события:", error);
            }

        });

    });

}
