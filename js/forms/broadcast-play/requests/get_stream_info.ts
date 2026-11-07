// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StreamInfo } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса состояния потока.
 ***************************************************************************
 */
export interface GetStreamInfoData {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Запрос состояния потока трансляции.
 *
 * Единственный признак того, что поток реально идёт: ответ приходит
 * null, когда эфир не ведётся. Модуль запроса пробрасывает ошибку
 * наружу: разбирает её вызывающий код (см. functions/stream_info_update.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера данными потока либо null без потока.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getStreamInfoRequest(data: GetStreamInfoData): Promise<Answer<StreamInfo | null>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StreamInfo | null>("[broadcast]: get stream info", data);

}
