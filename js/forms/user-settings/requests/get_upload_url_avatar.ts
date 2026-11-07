// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudUploadTarget } from "../../cloud/requests/get_upload_file_url.js";

/**
 * ***************************************************************************
 * Данные запроса пре-подписанного URL загрузки аватара.
 ***************************************************************************
 */
export interface GetUploadAvatarUrlData {

    /** Оригинальное имя файла. */
    file_name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Размер файла в байтах. */
    size: number;

}

/**
 * Цели загрузки и документ для сохранения аватара.
 */
export interface GetUploadAvatarUrlResult {

    /** Id документа (дальше идёт в "save avatar"). */
    document_id: string;

    /** Цели загрузки в S3 (оригинал плюс производные). */
    targets: CloudUploadTarget[];

}

/**
 * ***************************************************************************
 * Получение пре-подписанного URL для загрузки аватара в S3.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/choose_photo.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера целями загрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getUploadAvatarUrlRequest(data: GetUploadAvatarUrlData): Promise<Answer<GetUploadAvatarUrlResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<GetUploadAvatarUrlResult>("[user]: get upload avatar url", data);

}
