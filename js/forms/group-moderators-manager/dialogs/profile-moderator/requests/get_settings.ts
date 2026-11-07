// Импортируем config
import { Socket } from "../../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../../types/domain.js";
import type { GroupModeratorRecord } from "../../../types.js";

/**
 * Данные запроса настроек модератора.
 */
export interface GetModeratorSettingsData {

    /** Id канала (группы). */
    channel_id: string;

    /** Id пользователя-модератора. */
    user_id: string;

}

/**
 * ************************************************************************
 * Запрос настроек модератора группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера данными модератора.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ************************************************************************
 */
export async function getModeratorSettingsRequest(data: GetModeratorSettingsData): Promise<Answer<GroupModeratorRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GroupModeratorRecord>("[group]: get moderator settings", data);

}
