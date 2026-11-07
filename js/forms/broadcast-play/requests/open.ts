// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { BroadcastCast } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса открытия трансляции.
 ***************************************************************************
 */
export interface OpenCastData {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Открытие трансляции: данные трансляции с токеном просмотра.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts, _onBeforeOpen).
 * @param data - Данные запроса.
 * @returns Ответ сервера данными трансляции.
 * @throws Ошибка сокета/таймаута (включая коды CAST_ID_REQUIRED,
 *         INVALID_CAST_ID) пробрасывается без изменений.
 ***************************************************************************
 */
export async function openCastRequest(data: OpenCastData): Promise<Answer<BroadcastCast>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BroadcastCast>("[broadcast]: open", data);

}
