// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { GroupTopicSettingsRecord } from "../types.js";

/**
 * Данные запроса настроек темы группы.
 */
export interface GroupTopicSettingsGetData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос настроек темы группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера с настройками темы.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getSettingsRequest(data: GroupTopicSettingsGetData): Promise<Answer<GroupTopicSettingsRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group-topic]: get settings", data);

}
