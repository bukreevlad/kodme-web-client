// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса выхода из звонка.
 */
export interface LeaveCallData {

    /** Id звонка. */
    call_id: string;

}

/**
 * ***************************************************************************
 * Выход участника из звонка.
 *
 * Идемпотентен на сервере: если звонок уже завершён (вебхук, другой
 * участник), запрос просто ничего не сделает. Поэтому он уходит и при
 * обычном нажатии «Завершить», и при закрытии формы по любой причине.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера (без данных).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function leaveRequest(data: LeaveCallData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[call]: leave", data);

}
