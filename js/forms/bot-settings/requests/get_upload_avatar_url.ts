// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudUploadTarget } from "../../cloud/requests/get_upload_file_url.js";

/**
 * Данные запроса пре-подписанного URL загрузки аватара бота.
 */
export interface GetBotUploadAvatarUrlData {

    /** Id бота. */
    bot_id: string;

    /** Оригинальное имя файла. */
    file_name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Размер файла в байтах. */
    size: number;

}

/**
 * Цели загрузки и документ для сохранения аватара бота.
 */
export interface GetBotUploadAvatarUrlResult {

    /** Id документа (дальше идёт в "save avatar"). */
    document_id: string;

    /** Цели загрузки в S3 (оригинал). */
    targets: CloudUploadTarget[];

}

/**
 * ***************************************************************************
 * Получение пре-подписанного URL для загрузки аватара бота в S3.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/choose_photo.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера целями загрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getBotUploadAvatarUrlRequest(data: GetBotUploadAvatarUrlData): Promise<Answer<GetBotUploadAvatarUrlResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<GetBotUploadAvatarUrlResult>("[bot]: get upload avatar url", data);

}
