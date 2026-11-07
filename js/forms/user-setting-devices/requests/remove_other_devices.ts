// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса удаления всех сессий, кроме текущей.
 ***************************************************************************
 */
export interface RemoveOtherSessionsData {

    /** Id текущей (оставляемой) сессии. */
    active_session_id: string;

}

/**
 * ***************************************************************************
 * Удаление всех сессий, кроме текущей.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove_other_devices.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeOtherSessionsRequest(data: RemoveOtherSessionsData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[session]: remove other", data);

}
