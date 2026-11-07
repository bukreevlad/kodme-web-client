// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления обложки трансляции.
 */
export interface RemoveBroadcastThumbData {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Удаление обложки трансляции (снимает ссылку; идемпотентно — отсутствие
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
export async function removeThumbRequest(data: RemoveBroadcastThumbData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[broadcast]: remove thumb", data);

}
