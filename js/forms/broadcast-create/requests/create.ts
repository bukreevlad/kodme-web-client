// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания трансляции.
 */
export interface BroadcastCreateData {

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичный/Закрытый. */
    is_public: boolean;

    /** Чат трансляции. */
    is_chat: boolean;

}

/**
 * Ответ сервера: id созданной трансляции.
 */
export interface BroadcastCreateResponse {

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания трансляции.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает его вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с id созданной трансляции.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: BroadcastCreateData): Promise<Answer<BroadcastCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BroadcastCreateResponse>("[broadcast]: create", data);

}
