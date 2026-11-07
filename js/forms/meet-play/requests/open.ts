// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MeetInfo } from "../types.js";

/**
 * Данные запроса открытия конференции.
 */
export interface OpenData {

    /** Id конференции. */
    meet_id: string;

}

/**
 * ***************************************************************************
 * Открытие конференции: доступ, meta и токен для входа в комнату LiveKit.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts, _onBeforeOpen).
 * @param data - Данные запроса.
 * @returns Ответ сервера meta конференции с токеном входа.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function openRequest(data: OpenData): Promise<Answer<MeetInfo>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetInfo>("[meet]: open", data);

}
