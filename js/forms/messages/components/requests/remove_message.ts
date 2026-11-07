// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса удаления сообщения.
 */
export interface RemoveMessageData {

    /** Id сообщения. */
    message_id: string;

    /** Удалять для всех или только для себя. */
    for_all: boolean;

}

/**
 * ***************************************************************************
 * Удалить сообщение.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeMessageRequest(data: RemoveMessageData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<undefined>("[message]: remove", data);

}
