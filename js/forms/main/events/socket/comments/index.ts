// Импортируем events
import { subscribeCommentsNew } from "./new.js";
import { subscribeCommentsUpdate } from "./update.js";
import { subscribeCommentsRemove } from "./remove.js";
import { subscribeCommentsUpdatePostCommenting } from "./update_post_commenting.js";

// Импортируем utils
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

/**
 * ***************************************************************************
 * Подписки на события комментариев (новое, изменение, удаление, переключение
 * комментирования): все идут через одну общую очередь, чтобы изменения
 * применялись строго по порядку прихода — как у сообщений.
 *
 * Комментарии публикуются в комнату канала поста, поэтому обработчики
 * работают и когда форма ветки закрыта (счётчик поста).
 * ***************************************************************************
 */
export function subscribeComments(): void {

    // Очередь выполнения socket событий
    const asyncQueue = new AsyncQueue();

    subscribeCommentsNew(asyncQueue);
    subscribeCommentsUpdate(asyncQueue);
    subscribeCommentsRemove(asyncQueue);
    subscribeCommentsUpdatePostCommenting(asyncQueue);

}
