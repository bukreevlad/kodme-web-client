// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { ChannelSettingsRecord } from "../types.js";

/**
 * Данные запроса настроек канала.
 */
export interface ChannelSettingsGetData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос настроек канала.
 * @param data - Данные запроса.
 * @returns Ответ сервера с настройками канала.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getSettingsRequest(data: ChannelSettingsGetData): Promise<Answer<ChannelSettingsRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelSettingsRecord>("[channel]: get settings", data);

}
