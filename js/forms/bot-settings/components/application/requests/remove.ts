// Импортируем config
import { Socket } from "../../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../../types/domain.js";

/**
 * Данные запроса удаления приложения бота.
 */
export interface RemoveBotAppData {

    /** Id приложения бота. */
    bot_app_id: string;

}

/**
 * ***************************************************************************
 * Удаление приложения бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeRequest(data: RemoveBotAppData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bots-apps]: remove", data);

}
