// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса смены ссылки бота.
 */
export interface SaveBotLinkRequestData {

    /** Id бота. */
    bot_id: string;

    /** Новая ссылка. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос смены ссылки бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function saveBotLinkRequest(data: SaveBotLinkRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bot]: save link", data);

}
