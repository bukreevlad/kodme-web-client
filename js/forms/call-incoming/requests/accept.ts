// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса принятия входящего звонка.
 */
export interface AcceptCallRequestData {

    /** Id звонка. */
    call_id: string;

}

/**
 * Полезная нагрузка ответа принятия звонка.
 */
export interface AcceptCallResponse {

    /** Id звонка. */
    call_id: string;

    /** LiveKit-токен входа в комнату. */
    token: string;

}

/**
 * ***************************************************************************
 * Запрос принятия входящего звонка.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/accept.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера: id звонка и LiveKit-токен в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function acceptCallRequest(data: AcceptCallRequestData): Promise<Answer<AcceptCallResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<AcceptCallResponse>("[call]: accept", data);

}
