// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения публичной ссылки профиля.
 ***************************************************************************
 */
export interface SaveLinkData {

    /** Публичная ссылка профиля. */
    link: string;

}

/**
 * ***************************************************************************
 * Сохранение публичной ссылки профиля.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды LINK_ALREADY_TAKEN,
 *         LINK_INVALID) пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveLinkRequest(data: SaveLinkData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[user]: save link", data);

}
