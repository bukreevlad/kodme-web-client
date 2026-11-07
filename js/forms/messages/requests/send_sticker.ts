// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CreateMessageResult } from "./create_message.js";

/**
 * Данные запроса отправки стикер-сообщения.
 */
export interface SendStickerRequestData {

    /** Id канала. */
    channel_id: string;

    /** Id документа стикера. */
    sticker_document_id: string;

}

/**
 * ***************************************************************************
 * Отправить стикер-сообщение в канал.
 *
 * Запрос идёт обычным `[message]: send` c полем `sticker_document_id`
 * и пустым текстом (сервер считает стикер содержимым сообщения).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/send_sticker.ts`).
 * @param data - Данные стикер-сообщения.
 * @returns Id сообщения, присвоенный сервером.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function sendStickerRequest(data: SendStickerRequestData): Promise<Answer<CreateMessageResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateMessageResult>("[message]: send", {
            channel_id: data.channel_id,
            text: "",
            sticker_document_id: data.sticker_document_id
        });

}
