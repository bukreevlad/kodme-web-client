// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления канала.
 */
export interface ChannelRemoveData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос полного удаления канала.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (removeHandler).
 * ***************************************************************************
 */
export async function removeRequest(data: ChannelRemoveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[channel]: remove", data);

}
