// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления аватара темы группы.
 */
export interface RemoveGroupTopicAvatarData {

    /** Id темы. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Удаление аватара темы группы (снимает ссылку; идемпотентно — отсутствие
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
export async function removeAvatarRequest(data: RemoveGroupTopicAvatarData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[group-topic]: remove avatar", data);

}
