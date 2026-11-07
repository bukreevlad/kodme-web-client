// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания канала.
 */
export interface ChannelCreateData {

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичный/Закрытый. */
    is_public: boolean;

    /** Кто может публиковать. */
    is_posting: boolean;

    /** Разрешено комментирование. */
    is_commenting: boolean;

}

/**
 * Ответ сервера: id созданного канала.
 */
export interface ChannelCreateResponse {

    /** Id канала. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с id созданного канала.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: ChannelCreateData): Promise<Answer<ChannelCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelCreateResponse>("[channel]: create", data);

}
