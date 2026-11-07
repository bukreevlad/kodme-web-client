// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания диалога.
 */
export interface CreateDialogData {

    /** Id собеседника. */
    user_id: string;

}

/**
 * Ответ сервера: id канала созданного диалога.
 */
export interface CreateDialogResponse {

    /** Id канала диалога. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания диалога с пользователем.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create_chat.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера id'ом канала диалога.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createDialogRequest(data: CreateDialogData): Promise<Answer<CreateDialogResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateDialogResponse>("[dialog]: create", data);

}
