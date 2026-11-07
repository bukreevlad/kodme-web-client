// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса реакций сообщений.
 */
export interface GetMessageReactionsData {

    /** Id канала (клиент передаёт его, хотя сервер читает только message_ids). */
    channel_id?: string;

    /** Массив Id сообщений. */
    message_ids: string[];

}

/**
 * ***************************************************************************
 * Получить реакции сообщений (поллинг видимых сообщений).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/reactions_updater.js`).
 * @param data - Данные запроса.
 * @returns Реакции по id сообщений (id → список реакций).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getMessageReactionsRequest(data: GetMessageReactionsData): Promise<Answer<Record<string, unknown>>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<Record<string, unknown>>("[message]: get reactions", data);

}
