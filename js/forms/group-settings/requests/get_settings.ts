// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { GroupSettingsRecord } from "../types.js";

/**
 * Данные запроса настроек группы.
 */
export interface GroupSettingsGetData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос настроек группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера с настройками группы.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getSettingsRequest(data: GroupSettingsGetData): Promise<Answer<GroupSettingsRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: get settings", data);

}
