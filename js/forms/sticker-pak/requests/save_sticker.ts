// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StickerItem } from "../types.js";

/**
 * Данные запроса сохранения стикера.
 */
export interface SaveStickerRequestData {

    /** Id пака. */
    pak_id: string;

    /** Id загруженного документа. */
    document_id: string;

}

/**
 * Данные ответа сохранения стикера: стикер + фактические размеры.
 */
export interface SaveStickerResult extends StickerItem {

    /** Фактическая ширина изображения (проверена сервером). */
    width: number;

    /** Фактическая высота изображения (проверена сервером). */
    height: number;

}

/**
 * ***************************************************************************
 * Запрос сохранения стикера: сервер проверяет загруженный объект
 * (реальные размеры WEBP), ждёт серверной обработки (превью/LQIP) и
 * привязывает документ к паку.
 *
 * Таймаут — 120 с (SAVE_ATTACH): ожидание обработки на сервере до 100 с,
 * сервер отвечает раньше клиента. Модуль запроса только отправляет запрос
 * и пробрасывает ошибку наружу: разбирает её вызывающий код
 * (см. functions/choose_sticker.ts).
 * @param data - Данные запроса.
 * @returns Ответ со стикером и токеном на чтение.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function saveStickerRequest(data: SaveStickerRequestData): Promise<Answer<SaveStickerResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH)
        .emitWithAck<SaveStickerResult>("[sticker]: save sticker", data);

}
