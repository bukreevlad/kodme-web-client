// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса очистки истории канала.
 */
export interface ClearHistoryData {

    /** Id канала. */
    channel_id: string;

    /** Удалить для всех участников (диалог) или только для себя. */
    for_all: boolean;

}

/**
 * ***************************************************************************
 * Очистить историю сообщений канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function clearHistoryRequest(data: ClearHistoryData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[message]: clear history", data);

}
