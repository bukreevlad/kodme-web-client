// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса статуса набора текста.
 */
export interface TypingStatusData {

    /** Id канала. */
    channel_id: string;

    /** Тип действия (например, "typing"). */
    action: string;

}

/**
 * ***************************************************************************
 * Отправить статус активности (набор текста) в канал.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/typing_status.js`).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function typingStatusRequest(data: TypingStatusData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[channel-member]: typing status", data);

}
