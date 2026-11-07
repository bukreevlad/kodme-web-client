// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса пересылки сообщения.
 */
export interface ForwardMessageData {

    /** Id пересылаемого сообщения. */
    message_id: string;

    /** Id каналов-получателей. */
    channel_ids: string[];

}

/**
 * ***************************************************************************
 * Переслать сообщение в другие каналы.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function forwardMessageRequest(data: ForwardMessageData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<undefined>("[message]: forward", data);

}
