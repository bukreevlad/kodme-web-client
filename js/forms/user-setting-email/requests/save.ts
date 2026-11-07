// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения email пользователя.
 ***************************************************************************
 */
export interface SaveEmailData {

    /** Email. */
    email: string;

}

/**
 * ***************************************************************************
 * Сохранение email пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды EMAIL_REQUIRED, EMAIL_INVALID,
 *         EMAIL_ALREADY_TAKEN) пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveEmailRequest(data: SaveEmailData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[user]: save email", data);

}
