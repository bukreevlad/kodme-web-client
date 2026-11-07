// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса удаления ссылки из «Доступное для меня».
 ***************************************************************************
 */
export interface RemoveAvailableLinkData {

    /** Id ссылки. */
    link_id: string;

}

/**
 * Ответ сервера: id удалённой ссылки (клиент читает только успех).
 */
export interface RemoveAvailableLinkResult {

    /** Id удалённой ссылки. */
    link_id: string;

}

/**
 * ***************************************************************************
 * Удаление ссылки из списка «Доступное для меня» (сама ссылка не отзывается).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove_available_link.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeAvailableLinkRequest(data: RemoveAvailableLinkData): Promise<Answer<RemoveAvailableLinkResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<RemoveAvailableLinkResult>("[cloud]: remove available link", data);

}
