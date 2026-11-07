// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса включения web push-уведомлений.
 ***************************************************************************
 */
export interface EnableWebPushData {

    /** Endpoint подписки браузера. */
    endpoint: string;

    /** Ключ подписки (p256dh, base64). */
    key: string;

    /** Секрет подписки (auth, base64). */
    auth: string;

}

/**
 * ***************************************************************************
 * Включение web push-уведомлений.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/enable_web.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function enableWebPushRequest(data: EnableWebPushData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[session]: enable web push", data);

}
