// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { EntityType } from "../types.js";

/**
 * Данные запроса сохранения позиции чтения ветки.
 */
export interface UpdateLastViewedCommentData {

    /** Id поста (сообщения). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: EntityType;

    /** Id комментария, до которого пользователь долистал. */
    comment_id: string;

}

/**
 * ***************************************************************************
 * Сохранить позицию чтения ветки комментариев.
 *
 * Сервер двигает позицию только вперёд (`greatest`) — защита от гонки
 * с IntersectionObserver при пакетной отправке.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/last_viewed_batcher.js`).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function updateLastViewedCommentRequest(data: UpdateLastViewedCommentData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[comment-member]: update last viewed comment", data);

}
