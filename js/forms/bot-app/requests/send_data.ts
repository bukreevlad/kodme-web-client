// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса отправки данных WebApp-приложения боту.
 */
export interface SendDataRequestData {

    /** Id приложения бота. */
    bot_app_id: string;

    /** Данные приложения (непустая строка до 8000 символов). */
    data: string;

}

/**
 * ***************************************************************************
 * Запрос отправки данных WebApp-приложения боту.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/bridge.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте (полезная нагрузка пустая).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function sendDataRequest(data: SendDataRequestData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bots-apps]: send data", data);

}
