// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса старта звонка.
 */
export interface StartCallData {

    /** Id пользователя, кому звоним. */
    user_id: string | null;

}

/**
 * Ответ сервера стартом звонка.
 */
export interface StartCallResult {

    /** Id созданного звонка. */
    call_id: string;

    /** Токен LiveKit для подключения к комнате звонка. */
    token: string;

    /** Звонок уже существовал — инициатор влит в активный звонок. */
    is_merged: boolean;

}

/**
 * ***************************************************************************
 * Старт звонка: сервер создаёт звонок или вливает инициатора
 * в уже активный звонок собеседника.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/start_call.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function startCallRequest(data: StartCallData): Promise<Answer<StartCallResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StartCallResult>("[call]: start", data);

}
