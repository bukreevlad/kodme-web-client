// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";
import type { MessageReaction } from "../types.js";

/**
 * Данные запроса отправки реакции.
 */
export interface MessageSendReactionData {

    /** Id сообщения. */
    message_id: string;

    /** Emoji реакция. */
    reaction: string;

}

/**
 * ***************************************************************************
 * Отправить реакцию на сообщение.
 *
 * Сервер возвращает актуальный полный список реакций сообщения.
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Список реакций сообщения.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function messageSendReactionRequest(data: MessageSendReactionData): Promise<Answer<MessageReaction[] | undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<MessageReaction[] | undefined>("[message]: send reaction", data);

}
