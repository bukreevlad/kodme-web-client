// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { EntityType } from "../types.js";

/**
 * Данные запроса отправки комментария.
 */
export interface CreateCommentData {

    /** Id поста (сообщения). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: EntityType;

    /** Текст комментария. */
    text: string;

    /** Id комментария, на который отвечаем (null — без ответа). */
    reply_to_comment_id?: string | null;

    /** Вложения: мапа `{[document_id]: {...}}` (null — без вложений). */
    attachments?: Record<string, unknown> | null;

}

/**
 * Ответ `[comment]: send`: id созданного комментария.
 */
export interface CreateCommentResult {

    /** Id комментария. */
    comment_id: string;

}

/**
 * ***************************************************************************
 * Отправить комментарий.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/sending_comments.js`).
 * @param data - Данные запроса.
 * @returns Id комментария.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createCommentRequest(data: CreateCommentData): Promise<Answer<CreateCommentResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateCommentResult>("[comment]: send", data);

}
