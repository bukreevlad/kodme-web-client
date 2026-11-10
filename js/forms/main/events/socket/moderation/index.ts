// Импортируем utils
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем события
import { subscribeModerationCleaned } from "./cleaned.js";
import { subscribeModerationMemberBanned } from "./member_banned.js";
import { subscribeModerationMemberUnbanned } from "./member_unbanned.js";

/**
 * ***************************************************************************
 * Подписка на события модерации канала: чистка сообщений участника,
 * блокировка, разблокировка.
 * ***************************************************************************
 */
export function subscribeModeration(): void {

    // Очередь сообщений модерации (порядок обработки событий)
    const asyncQueue = new AsyncQueue();

    subscribeModerationCleaned(asyncQueue);
    subscribeModerationMemberBanned(asyncQueue);
    subscribeModerationMemberUnbanned(asyncQueue);

}
