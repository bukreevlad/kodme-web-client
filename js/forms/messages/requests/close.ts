// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/** Данные закрытия канала. */
export interface CloseChannelData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Сообщить серверу о закрытии канала: снимается временная подписка сокета
 * на комнаты канала (постоянные подписки подписчиков не трогаются).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (закрытие формы).
 * @param data - Данные закрытия ({ channel_id }).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function closeChannelRequest(data: CloseChannelData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[channel]: close", data);

}
