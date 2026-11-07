// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { BroadcastSettingsRecord } from "../types.js";

/**
 * Данные запроса настроек трансляции.
 */
export interface BroadcastCastSettingsGetData {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Запрос настроек трансляции.
 * @param data - Данные запроса.
 * @returns Ответ сервера с настройками трансляции.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getCastSettingsRequest(data: BroadcastCastSettingsGetData): Promise<Answer<BroadcastSettingsRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BroadcastSettingsRecord>("[broadcast]: get settings", data);

}
