// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса удаления всех сообщений участника.
 */
export interface CleanUserMessagesData {

    /** Id канала. */
    channel_id: string;

    /** Id автора, чьи сообщения удаляются. */
    user_id: string;

}

/**
 * Ответ чистки сообщений участника.
 */
export interface CleanUserMessagesResult {

    /** Сколько сообщений удалено. */
    removed: number;

    /** Новый pts канала. */
    pts: number;

}

/**
 * ***************************************************************************
 * Удалить все сообщения участника в канале.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера числом удалённых сообщений и новым pts.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function cleanUserMessagesRequest(data: CleanUserMessagesData): Promise<Answer<CleanUserMessagesResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<CleanUserMessagesResult>("[moderation]: clean user messages", data);

}
