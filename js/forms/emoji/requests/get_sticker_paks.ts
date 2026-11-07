// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StickerPakItem } from "../../sticker-paks/types.js";

/**
 * Данные запроса страницы списка паков стикеров.
 */
export interface GetStickerPaksRequestData {

    /** Смещение (пагинация: номер позиции первой записи страницы). */
    offset?: number;

    /** Количество записей (по умолчанию 50, максимум 100). */
    limit?: number;

}

/**
 * Ответ сервера списком паков с признаком продолжения.
 */
export type GetStickerPaksResult = Answer<StickerPakItem[]> & {

    /** Есть ли продолжение после текущей страницы. */
    has_more?: boolean;

};

/**
 * ***************************************************************************
 * Запрос страницы списка паков стикеров для панели «Стикеры» формы эмодзи.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/load_sticker_paks.ts).
 * @param data - Данные запроса.
 * @returns Страница списка паков с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getStickerPaksRequest(data: GetStickerPaksRequestData): Promise<GetStickerPaksResult> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakItem[]>("[sticker]: get paks", data);

}
