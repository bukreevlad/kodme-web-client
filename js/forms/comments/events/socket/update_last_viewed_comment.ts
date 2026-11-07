// Импортируем config
import { Socket } from "../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { CommentList } from "../../functions/comment_list.js";

// Импортируем типы
import type { SocketEventHandler } from "../../../../config/socket.js";
import type { Comments } from "../../index.js";

/**
 * Нагрузка ws-события обновления просмотренного комментария.
 */
interface ViewedCommentPayload {

    /** Id поста (сущности-владельца). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: string;

    /** Id просмотренного комментария. */
    last_viewed_comment_id: string;

}

/**
 * Значение — нагрузка обновления просмотренного комментария.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isViewedCommentPayload(value: unknown): value is ViewedCommentPayload {
    return Boolean(value
        && typeof value === "object"
        && typeof (value as ViewedCommentPayload).entity_id === "string"
        && typeof (value as ViewedCommentPayload).last_viewed_comment_id === "string");
}

/**
 * ***************************************************************************
 * subscribeUpdateLastViewedComment - подписка на отметку «прочитано» у самого
 * пользователя для открытой ветки комментариев.
 *
 * Сервер публикует эхо в комнату `user::<user_id>` (см.
 * `services/comments-members/update_last_viewed_comment.ts`). Локально позиция
 * нужна, чтобы убрать разделитель «Новые комментарии», если пользователь
 * за один заход прочитал ветку до конца. Если ветка не открыта — событие
 * игнорируется (у комментариев нет глобального стора, в отличие от каналов).
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события.
 * ***************************************************************************
 */
export function subscribeUpdateLastViewedComment(form: Comments): (() => void) | null {

    // Если формы нет
    if (!form) return null;

    // Обработчик события сокета
    const handler: SocketEventHandler = (data: unknown): void => {

        try {

            // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
            if (!isViewedCommentPayload(data)) return;

            // Эхо относится к другой ветке — игнорируем
            if (data.entity_id !== form.postId) return;

            // invariant: сервер двигает позицию только вперёд (greatest),
            // поэтому локальное значение не может «откатиться» назад
            const commentId = data.last_viewed_comment_id;
            if (!commentId) return;

            // Запоминаем позицию чтения
            form.lastViewedCommentId = commentId;

            // Если разделитель «Новые комментарии» уже позади — убираем его
            if (form.newDividerBeforeId && commentId >= form.newDividerBeforeId) {
                form.newDividerBeforeId = null;
                CommentList.placeNewCommentsDivider(form);
            }

        } catch (error) {
            Logger.error("[app][comments][update-last-viewed]", error);
        }

    };

    // Подписываемся на событие сокета (инвариант: on/off — существующий API)
    Socket.client.on("[comment-member]: update last viewed comment", handler);

    // Функция отписки: снимает обработчик по той же ссылке. Складывается в
    // form.storeUnsubs — тот же массив, что и у Store-событий: его гасит
    // unsubscribeStoreEvents в _onBeforeClose, иначе подписка жила бы вечно
    return () => {
        Socket.client.off("[comment-member]: update last viewed comment", handler);
    };

}
