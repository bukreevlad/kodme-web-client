// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания конференции.
 */
export interface MeetCreateData {

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная / приватная. */
    is_public: boolean;

    /** Чат конференции. */
    is_chat: boolean;

}

/**
 * Ответ сервера: id созданной конференции.
 */
export interface MeetCreateResponse {

    /** Id конференции. */
    meet_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания конференции.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера id'ом конференции.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: MeetCreateData): Promise<Answer<MeetCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetCreateResponse>("[meet]: create", data);

}
