// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MessageRecord, MessagesDirection } from "../types.js";

/**
 * Данные запроса истории сообщений канала.
 */
export interface GetMessagesHistoryData {

    /** Id канала. */
    channel_id: string;

    /** Загрузить старше последнего просмотренного. */
    after_last_viewed_message?: boolean;

    /** Направление загрузки ["prev" | "next"]. */
    direction?: MessagesDirection;

    /** Id сообщения, откуда начинать. */
    cursor_id?: string;

    /** Количество сообщений. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Получить страницу истории сообщений канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/*_messages.js`).
 * @param data - Данные запроса.
 * @returns Страница сообщений.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getMessagesHistoryRequest(data: GetMessagesHistoryData): Promise<Answer<MessageRecord[]>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MessageRecord[]>("[message]: get history", data);

}
