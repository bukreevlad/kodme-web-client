// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Comments } from "../../../../comments/index.js";

// Импортируем functions
import { getSessionUserId } from "../../../functions/session_identity.js";
import { awaitPendingAcks } from "../../../../comments/functions/sending_comments.js";
import { CommentList } from "../../../../comments/functions/comment_list.js";
import { updateCommentsCount } from "../../../../comments/functions/push_state.js";
import { applyCommentsCountDelta } from "./count_comments.js";

// Импортируем типы
import { isCommentRecord } from "../../../../comments/types.js";
import type { CommentStoreAddOptions } from "../../../../comments/types.js";

/**
 * ***************************************************************************
 * Подписка на новый комментарий: счётчик поста увеличивается на 1 (даже
 * когда форма ветки закрыта), а открытая форма дорисовывает комментарий или
 * подменяет локальное эхо серверным id.
 *
 * Все события комментариев публикуются в комнату канала поста, поэтому
 * подписка срабатывает и для форм, открытых в других вкладках приложения.
 * @param asyncQueue - Общая очередь комментариев (см. subscribeComments).
 * ***************************************************************************
 */
export function subscribeCommentsNew(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Новый комментарий
    // ***************************************************************************
    Socket.client.on("[comment]: new", (data, timestamp) => {
        Logger.debug("[app][ws]::[comment]: new", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с записью комментария
                if (!isCommentRecord(data)) return;

                // Тип сущности поддерживается только "message" (см. comments/types.ts)
                if (data.entity_type != null && data.entity_type !== "message") return;

                // Id поста обязателен: без него комментарий не к чему привязать
                const entityId = data.entity_id;
                if (typeof entityId !== "string" || !entityId) return;

                // Счётчик поста +1 во всех случаях (форма открыта или нет)
                await applyCommentsCountDelta(entityId, data.channel_id, 1);

                // ======================================

                // Форма ветки открыта — дорисовываем комментарий в ленте
                const form = Comments.instances.get(entityId);
                if (!form) return;

                // Подзаголовок формы («N комментариев»)
                updateCommentsCount(form, (form.post?.count_comments ?? 0) + 1);

                // Возможно, это эхо собственной отправки: пуш `[comment]: new`
                // приходит в комнату канала и отправителю, и мог обогнать ответ
                // на `[comment]: send` — детерминированно ждём исходов отправки
                let existing = form.store.get(data.id);
                if (!existing && (form.pendingIds?.size ?? 0) > 0
                    && data.created_user_id === getSessionUserId()) {

                    await awaitPendingAcks(form);
                    existing = form.store.get(data.id);

                }

                // Комментарий уже в Store (свой эхо после replaceId либо чужой,
                // пришедший параллельно с догрузкой истории) — гидратация
                if (existing) {

                    // Снятие флагов отправки дублирует ack: пуш мог прийти
                    // раньше или позже ответа сервера
                    const syncFlags = { is_sending: false, is_error_sending: false };
                    form.store.update(data.id, { ...data, ...syncFlags });

                    // Локальный id исходящего больше не актуален
                    form.pendingIds?.delete(data.id);

                    return;

                }

                // Новый комментарий: подтягиваем ленту вниз, только если читатель
                // сидел в хвосте ДО вставки (сам скролл — в подписке item::added)
                if (CommentList.isLastItemVisible(form)) form._stickToBottom = true;

                // Вставка в хвост ленты (direction пробрасывается подписчикам item::added)
                const addOptions: CommentStoreAddOptions = { direction: "next" };
                form.store.add(data, addOptions);

            } catch (error) {
                Logger.error("[app][ws][comments][new]", error);
            }

        });
    });
}
