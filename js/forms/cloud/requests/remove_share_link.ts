// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса отзыва ссылки общего доступа.
 ***************************************************************************
 */
export interface RemoveShareLinkData {

    /** Id ссылки. */
    link_id: string;

}

/**
 * Ответ сервера: id отозванной ссылки (клиент читает только успех).
 */
export interface RemoveShareLinkResult {

    /** Id отозванной ссылки. */
    link_id: string;

}

/**
 * ***************************************************************************
 * Отзыв ссылки общего доступа (ссылка перестаёт открываться).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove_share_link.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeShareLinkRequest(data: RemoveShareLinkData): Promise<Answer<RemoveShareLinkResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<RemoveShareLinkResult>("[cloud]: remove share link", data);

}
