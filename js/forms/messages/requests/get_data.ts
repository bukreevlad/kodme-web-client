// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MessageRecord } from "../types.js";

/** Данные запроса сообщения. */
export interface GetMessageDataData {

    /** Id сообщения (UUID v7). */
    message_id: string;

}

/**
 * ***************************************************************************
 * Запросить сообщение по id.
 *
 * Фолбэк применения событий ленты: живой толчок несёт готовое сообщение,
 * а событие догонки — только id, и тогда сообщение дозапрашивается.
 *
 * @param data - Данные запроса ({ message_id }).
 * @returns Ответ сервера с объектом сообщения.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений: её разбирает
 *   вызывающий код.
 * ***************************************************************************
 */
export async function getMessageDataRequest(data: GetMessageDataData): Promise<Answer<MessageRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[message]: get data", data);

}
