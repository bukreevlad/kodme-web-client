// Импортируем events
import { subscribeMessagesNew } from "./new.js";
import { subscribeMessagesUpdate } from "./update.js";
import { subscribeMessagesRemove } from "./remove.js";
import { subscribeMessagesClearHistory } from "./clear_hystory.js";

// Импортируем utils
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

/**
 * ***************************************************************************
 * Подписки на события сообщений (новое, обновление, удаление, очистка
 * истории): все четыре идут через одну общую очередь, чтобы изменения
 * применялись строго по порядку прихода.
 * ***************************************************************************
 */
export function subscribeMessages(): void {

    // Очередь выполнения socket событий
    const asyncQueue = new AsyncQueue();

    subscribeMessagesNew(asyncQueue);
    subscribeMessagesUpdate(asyncQueue);
    subscribeMessagesRemove(asyncQueue);
    subscribeMessagesClearHistory(asyncQueue);

}
