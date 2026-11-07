// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { GroupModeratorFlags } from "../../group-moderators-manager/types.js";

/**
 * Данные запроса добавления модератора группы.
 */
export interface AddModeratorData extends GroupModeratorFlags {

    /** Id канала (группы). */
    channel_id: string;

    /** Id пользователя-модератора. */
    user_id: string;

}

/**
 * ************************************************************************
 * Запрос добавления модератора в группу.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (addModeratorHandler).
 * ************************************************************************
 */
export async function addModeratorRequest(data: AddModeratorData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: add moderator", data);

}
