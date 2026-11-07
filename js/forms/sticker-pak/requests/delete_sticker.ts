// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления стикера из пака.
 */
export interface DeleteStickerRequestData {

    /** Id пака. */
    pak_id: string;

    /** Id стикера (строка-связь вложения). */
    sticker_id: string;

}

/**
 * Данные ответа удаления стикера.
 */
export interface DeleteStickerAnswerData {

    /** Id стикера. */
    sticker_id: string;

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос удаления стикера из пака (сервер убирает строку-связь).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/sticker_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function deleteStickerRequest(data: DeleteStickerRequestData): Promise<Answer<DeleteStickerAnswerData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<DeleteStickerAnswerData>("[sticker]: delete sticker", data);

}
