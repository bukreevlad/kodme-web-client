// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Вложение запроса отправки сообщения (ключ объекта — document_id).
 */
export interface CreateMessageAttachment {

    /** Имя файла. */
    file_name: string;

}

/**
 * Данные запроса отправки сообщения.
 */
export interface CreateMessageData {

    /** Id канала. */
    channel_id: string;

    /** Текст сообщения. */
    text: string;

    /** Id сообщения, на которое отвечаем (null — без ответа). */
    reply_to_message_id?: string | null;

    /** Вложения: объект, ключи — document_id из get upload attach url. */
    attachments?: Record<string, CreateMessageAttachment>;

    /** Id документа стикера (sticker-сообщение). */
    sticker_document_id?: string | null;

    /**
     * Клиентский ключ идемпотентности (у исходящих — локальный id):
     * повтор запроса с тем же ключом не создаёт дубль.
     */
    random_id?: string | null;

}

/**
 * Ответ сервера на отправку сообщения.
 */
export interface CreateMessageResult {

    /** Id созданного сообщения на сервере. */
    message_id: string;

}

/**
 * ***************************************************************************
 * Отправить сообщение в канал.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/sending_messages.js`).
 * @param data - Данные сообщения.
 * @returns Id сообщения, присвоенный сервером.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createMessageRequest(data: CreateMessageData): Promise<Answer<CreateMessageResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CreateMessageResult>("[message]: send", data);

}
