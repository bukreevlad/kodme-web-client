// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MessageReaction } from "../../messages/components/types.js";

/**
 * Данные запроса реакций комментариев.
 */
export interface CommentGetReactionsData {

    /** Id комментариев (пачкой, для поллинга видимых строк). */
    comment_ids: string[];

}

/**
 * ***************************************************************************
 * Получить реакции комментариев: мапа `{ [comment_id]: Reaction[] }`.
 *
 * Для каждого id ключ присутствует всегда (пустой массив — реакций нет).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/reactions_updater.js`).
 * @param data - Данные запроса.
 * @returns Мапа реакций по id комментариев.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function commentGetReactionsRequest(data: CommentGetReactionsData): Promise<Answer<Record<string, MessageReaction[]>>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<Record<string, MessageReaction[]>>("[comment]: get reactions", data);

}
