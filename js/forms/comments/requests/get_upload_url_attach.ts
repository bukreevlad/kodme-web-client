// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { EntityType } from "../types.js";
import type { UploadAttachResult } from "../../messages/requests/get_upload_url_attach.js";

/**
 * Данные запроса presigned URL для вложения комментария.
 */
export interface GetUploadUrlAttachData {

    /** Id поста (сообщения). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: EntityType;

    /** Оригинальное имя файла. */
    file_name: string;

    /** MIME-тип файла (сервер сверяет его с расширением). */
    mime_type: string;

    /** Размер файла в байтах. */
    size: number;

    /** Метаданные файла. */
    metadata?: unknown;

}

/**
 * ***************************************************************************
 * Получить presigned URL и лимиты для загрузки вложения комментария.
 *
 * Формат ответа единообразен с `[message]: get upload attach url`
 * (targets + document_id); лимиты приходят при авторизации (config/limits.ts).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/import_attaches.js`).
 * @param data - Данные запроса.
 * @returns URL, id документа и цели загрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUploadUrlAttachRequest(data: GetUploadUrlAttachData): Promise<Answer<UploadAttachResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<UploadAttachResult>("[comment]: get upload attach url", data);

}
