// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { StickerPakAnswer, StickerPakData } from "../../sticker-pak/types.js";

/**
 * Данные запроса пака стикеров (для предзаполнения формы редактирования).
 */
export interface GetPakForEditRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос пака стикеров для формы редактирования.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts формы).
 * @param data - Данные запроса.
 * @returns Пак + список стикеров (форма читает только метаданные).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getPakForEditRequest(data: GetPakForEditRequestData): Promise<StickerPakAnswer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakData>("[sticker]: get pak", data);

}
