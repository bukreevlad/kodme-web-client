// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса удаления одной сессии (устройства).
 ***************************************************************************
 */
export interface RemoveSessionData {

    /** Id удаляемой сессии. */
    session_id: string;

}

/**
 * ***************************************************************************
 * Удаление одной сессии (устройства).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды SESSION_ID_*, USER_ID_*)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeSessionRequest(data: RemoveSessionData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[session]: remove", data);

}
