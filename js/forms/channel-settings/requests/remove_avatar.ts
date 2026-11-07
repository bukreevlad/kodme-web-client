// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления аватара канала.
 */
export interface RemoveChannelAvatarData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Удаление аватара канала (снимает ссылку; идемпотентно — отсутствие
 * аватара не ошибка).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/remove_photo.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута (включая код ACCESS_DENIED)
 *         пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeAvatarRequest(data: RemoveChannelAvatarData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[channel]: remove avatar", data);

}
