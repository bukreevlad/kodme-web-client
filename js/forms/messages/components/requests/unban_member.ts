// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса разблокировки участника.
 */
export interface UnbanMemberData {

    /** Id канала. */
    channel_id: string;

    /** Id разблокируемого участника. */
    user_id: string;

}

/**
 * ***************************************************************************
 * Разблокировать участника в канале.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function unbanMemberRequest(data: UnbanMemberData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[moderation]: unban member", data);

}
