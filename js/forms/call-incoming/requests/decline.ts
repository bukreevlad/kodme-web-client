// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Причина отклонения входящего звонка.
 */
export type CallDeclineReason = "declined" | "timeout";

/**
 * Данные запроса отклонения входящего звонка.
 */
export interface DeclineCallRequestData {

    /** Id звонка. */
    call_id: string;

    /** Причина: "declined" (нажали кнопку) или "timeout" (никто не ответил за таймер). */
    reason: CallDeclineReason;

}

/**
 * ***************************************************************************
 * Запрос отклонения входящего звонка.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/decline.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function declineCallRequest(data: DeclineCallRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[call]: decline", data);

}
