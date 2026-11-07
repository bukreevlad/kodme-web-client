// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса редактирования комментария.
 */
export interface UpdateCommentData {

    /** Id комментария. */
    comment_id: string;

    /** Новый текст комментария. */
    text: string;

}

/**
 * ***************************************************************************
 * Отредактировать комментарий.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код.
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function updateCommentRequest(data: UpdateCommentData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[comment]: update", data);

}
