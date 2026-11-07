// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса создания диалога с ботом.
 ***************************************************************************
 */
export interface CreateDialogData {

    /** Id бота. */
    bot_id: string;

}

/**
 * Полезная нагрузка ответа "[dialog]: create bot": id созданного
 * (либо уже существующего) канала-диалога.
 */
export interface CreateDialogPayload {

    /** Id канала диалога (UUID v7). */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Создание диалога с ботом.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create_chat.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с id канала диалога.
 * @throws Ошибка сокета/таймаута (включая коды ID_CANNOT_MATCH,
 *         INVALID_BOT_ID) пробрасывается без изменений.
 ***************************************************************************
 */
export async function createDialogRequest(data: CreateDialogData): Promise<Answer<CreateDialogPayload>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateDialogPayload>("[dialog]: create bot", data);

}
