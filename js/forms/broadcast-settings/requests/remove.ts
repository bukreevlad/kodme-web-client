// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления трансляции.
 */
export interface BroadcastRemoveData {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Запрос удаления трансляции.
 * @param data - Данные запроса.
 * @returns Ответ сервера (пустой при успехе).
 * @throws Error сервера — разбирает вызывающий код (removeHandler).
 * ***************************************************************************
 */
export async function removeRequest(data: BroadcastRemoveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[broadcast]: remove", data);

}
