// Импортируем config
import { Socket } from "../../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../../types/domain.js";
import type { GroupModeratorFlags } from "../../../types.js";

/**
 * Данные запроса сохранения настроек модератора. На проводе поле
 * идентификатора — user_id (сервер внутренне зовёт его moderator_id).
 */
export interface SaveModeratorData extends GroupModeratorFlags {

    /** Id канала (группы). */
    channel_id: string;

    /** Id пользователя-модератора. */
    user_id: string;

}

/**
 * ************************************************************************
 * Запрос сохранения настроек модератора группы.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (saveModeratorHandler).
 * ************************************************************************
 */
export async function saveModeratorRequest(data: SaveModeratorData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: save moderator settings", data);

}
