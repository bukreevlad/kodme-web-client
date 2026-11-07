// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MeetRecord } from "../../meets/types.js";

/**
 * Данные запроса настроек конференции.
 */
export interface MeetSettingsGetData {

    /** Id конференции. */
    meet_id: string;

}

/**
 * ***************************************************************************
 * Запрос настроек конференции.
 * @param data - Данные запроса.
 * @returns Ответ сервера с настройками конференции.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getMeetSettingsRequest(data: MeetSettingsGetData): Promise<Answer<MeetRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetRecord>("[meet]: get settings", data);

}
