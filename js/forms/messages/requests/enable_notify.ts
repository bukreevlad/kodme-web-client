// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса включения уведомлений канала.
 */
export interface EnableNotifyData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Включить уведомления канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function enableNotifyRequest(data: EnableNotifyData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[channel-member]: enable notify", data);

}
