// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления темы.
 */
export interface GroupTopicRemoveData {

    /** Id темы. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос полного удаления темы.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (removeHandler).
 * ***************************************************************************
 */
export async function removeRequest(data: GroupTopicRemoveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group-topic]: remove", data);

}
