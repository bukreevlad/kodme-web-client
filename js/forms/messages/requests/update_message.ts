// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса редактирования сообщения.
 */
export interface UpdateMessageData {

    /** Id сообщения. */
    message_id: string;

    /** Новый текст сообщения. */
    text: string;

}

/**
 * ***************************************************************************
 * Отредактировать текст сообщения.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function updateMessageRequest(data: UpdateMessageData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[message]: update", data);

}
