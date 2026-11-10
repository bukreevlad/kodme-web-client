// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления модератора группы.
 */
export interface GroupRemoveModeratorData {

    /** Id канала (группы). */
    channel_id: string;

    /** Id пользователя-модератора. */
    user_id: string;

}

/**
 * ************************************************************************
 * Запрос удаления модератора группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Error сервера — разбирает вызывающий код (removeModeratorHandler).
 * ************************************************************************
 */
export async function removeModeratorRequest(data: GroupRemoveModeratorData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[group]: remove moderator", data);

}
