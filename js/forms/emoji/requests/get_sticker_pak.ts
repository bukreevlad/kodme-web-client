// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { StickerPakAnswer, StickerPakData } from "../../sticker-pak/types.js";

/**
 * Данные запроса пака со стикерами.
 */
export interface GetStickerPakRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос пака со всеми стикерами для панели «Стикеры» формы эмодзи.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/open_sticker_pak.ts).
 * @param data - Данные запроса.
 * @returns Пак + список стикеров.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getStickerPakRequest(data: GetStickerPakRequestData): Promise<StickerPakAnswer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakData>("[sticker]: get pak", data);

}
