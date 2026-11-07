// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { StickerPakAnswer, StickerPakData } from "../types.js";

/**
 * Данные запроса пака стикеров.
 */
export interface GetPakRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос пака со всеми его стикерами (данные формы содержимого пака).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/load_pak.ts).
 * @param data - Данные запроса.
 * @returns Пак + список стикеров.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getPakRequest(data: GetPakRequestData): Promise<StickerPakAnswer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakData>("[sticker]: get pak", data);

}
