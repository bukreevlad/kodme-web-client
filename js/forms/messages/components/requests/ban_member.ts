// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса блокировки участника.
 */
export interface BanMemberData {

    /** Id канала. */
    channel_id: string;

    /** Id блокируемого участника. */
    user_id: string;

}

/**
 * ***************************************************************************
 * Забанить участника в канале (кик + бан).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута (ACCESS_DENIED, CANNOT_BAN_*) пробрасывается
 *         без изменений.
 * ***************************************************************************
 */
export async function banMemberRequest(data: BanMemberData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[moderation]: ban member", data);

}
