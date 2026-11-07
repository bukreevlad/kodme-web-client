// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { ChannelRecord } from "../types.js";

/**
 * Данные запроса открытия канала.
 */
export interface OpenChannelData {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Открыть канал: сервер присылает данные канала (у группы — вместе с темами).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код.
 * @param data - Данные запроса.
 * @returns Данные канала.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function openChannelRequest(data: OpenChannelData): Promise<Answer<ChannelRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelRecord>("[channel]: open", data);

}
