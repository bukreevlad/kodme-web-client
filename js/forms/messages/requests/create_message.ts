// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MessageRecord } from "../types.js";

/**
 * Ответ сервера на отправку сообщения.
 */
export interface CreateMessageResult {

    /** Id созданного сообщения на сервере. */
    message_id: string;

}

/**
 * ***************************************************************************
 * Отправить сообщение в канал.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/sending_messages.js`).
 * @param data - Данные сообщения (форма записи Store).
 * @returns Id сообщения, присвоенный сервером.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createMessageRequest(data: MessageRecord): Promise<Answer<CreateMessageResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateMessageResult>("[message]: send", data);

}
