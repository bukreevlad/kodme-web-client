// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления комментария.
 */
export interface RemoveCommentData {

    /** Id комментария. */
    comment_id: string;

}

/**
 * ***************************************************************************
 * Удалить комментарий.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (диалог подтверждения).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeCommentRequest(data: RemoveCommentData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[comment]: remove", data);

}
