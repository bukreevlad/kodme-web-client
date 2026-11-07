// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса генерации init-данных приложения бота.
 */
export interface GenerateInitDataRequestData {

    /** Id приложения бота. */
    bot_app_id: string;

}

/**
 * Полезная нагрузка ответа генерации init-данных.
 */
export interface BotAppInitData {

    /** Название приложения. */
    name: string;

    /** URL приложения. */
    url: string;

    /** Подпись init-данных (HMAC) для URL приложения. */
    hmac: string;

}

/**
 * ***************************************************************************
 * Запрос генерации init-данных приложения бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера: init-данные приложения в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function generateInitDataRequest(data: GenerateInitDataRequestData): Promise<Answer<BotAppInitData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BotAppInitData>("[bots-apps]: generate init data", data);

}
