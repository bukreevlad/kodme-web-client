// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudUploadTarget } from "../../cloud/requests/get_upload_file_url.js";

/**
 * Данные запроса пре-подписанного URL загрузки стикера.
 */
export interface GetUploadStickerUrlRequestData {

    /** Id пака. */
    pak_id: string;

    /** Оригинальное имя файла. */
    file_name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Размер файла в байтах. */
    size: number;

    /** Метаданные файла (у стикера производных нет — пустой объект). */
    metadata?: Record<string, unknown>;

}

/**
 * Цели загрузки и документ для сохранения стикера.
 *
 * Лимиты стикеров в ответ не входят: клиент получает их при авторизации
 * (POST /auth/check, поле `server_data.limits` — см. config/limits.ts).
 */
export interface GetUploadStickerUrlResult {

    /** Id документа (дальше идёт в "save sticker"). */
    document_id: string;

    /** Цели загрузки в S3 (только оригинал — производные у стикера нет). */
    targets: CloudUploadTarget[];

}

/**
 * ***************************************************************************
 * Получение пре-подписанного URL для загрузки стикера в S3.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/choose_sticker.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера целями загрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUploadStickerUrlRequest(data: GetUploadStickerUrlRequestData): Promise<Answer<GetUploadStickerUrlResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<GetUploadStickerUrlResult>("[sticker]: get upload sticker url", data);

}
