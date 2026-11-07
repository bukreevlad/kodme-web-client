// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления обложки конференции.
 */
export interface RemoveMeetThumbData {

    /** Id конференции. */
    meet_id: string;

}

/**
 * ***************************************************************************
 * Удаление обложки конференции (снимает ссылку; идемпотентно — отсутствие
 * обложки не ошибка).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/remove_thumb.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута (включая код ACCESS_DENIED)
 *         пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeThumbRequest(data: RemoveMeetThumbData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[meet]: remove thumb", data);

}
