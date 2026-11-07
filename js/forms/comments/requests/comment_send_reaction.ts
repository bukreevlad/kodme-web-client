// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса постановки/снятия реакции на комментарий.
 */
export interface CommentSendReactionData {

    /** Id комментария. */
    comment_id: string;

    /** Emoji-код реакции. */
    reaction: string;

}

/**
 * ***************************************************************************
 * Поставить или снять реакцию на комментарий.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`components/comment_reactions.js`).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function commentSendReactionRequest(data: CommentSendReactionData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[comment]: send reaction", data);

}
