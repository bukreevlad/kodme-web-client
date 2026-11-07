// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { StickerPakItem, StickerPakPage } from "../types.js";

/**
 * Данные запроса страницы списка паков стикеров.
 */
export interface GetPaksRequestData {

    /** Смещение (пагинация: номер позиции первой записи страницы). */
    offset?: number;

    /** Количество записей (по умолчанию 50, максимум 100). */
    limit?: number;

}

/**
 * ***************************************************************************
 * Запрос страницы списка паков стикеров (публичный каталог + свои).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_paks.ts).
 * @param data - Данные запроса.
 * @returns Страница списка паков с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getPaksRequest(data: GetPaksRequestData): Promise<StickerPakPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakItem[]>("[sticker]: get paks", data);

}
