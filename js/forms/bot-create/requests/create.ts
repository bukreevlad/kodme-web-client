// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания бота.
 */
export interface CreateBotRequestData {

    /** Публичное имя (ссылка) бота. */
    link: string;

    /** Описание бота. */
    bio: string;

    /** Публичный (виден всем) или закрытый бот. */
    is_public: boolean;

}

/**
 * ***************************************************************************
 * Запрос создания бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createBotRequest(data: CreateBotRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bot]: create", data);

}
