// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подписки на канал.
 */
export interface SubscribeChannelData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Подписаться на канал.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function subscribeChannelRequest(data: SubscribeChannelData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[channel-member]: subscribe", data);

}
