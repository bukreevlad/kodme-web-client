// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Цель загрузки вложения (presigned URL одного объекта).
 */
export interface UploadAttachTarget {

    /** Путь объекта в storage (server отдаёт его в каждой цели). */
    path: string;

    /** URL загрузки объекта. */
    url?: string;

    /** Ключ документа в storage. */
    key?: string;

    /** Служебные поля цели (bucket, method и т.п.). */
    [key: string]: unknown;

}

/**
 * Ответ сервера на выдачу presigned URL для вложения.
 *
 * Лимиты в ответ не входят: клиент получает их при авторизации
 * (POST /auth/check, поле `server_data.limits` — см. config/limits.ts).
 */
export interface UploadAttachResult {

    /** Основной URL (легаси). */
    url?: string;

    /** Id документа вложения. */
    document_id: string;

    /** Цели загрузки (объекты storage). */
    targets: UploadAttachTarget[];

}

/**
 * Данные запроса presigned URL для вложения.
 */
export interface GetUploadAttachURLData {

    /** Id канала. */
    channel_id: string;

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
 * Получить presigned URL и лимиты для загрузки вложения.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/sending_messages.js`).
 * @param data - Данные запроса.
 * @returns URL, id документа, цели загрузки и лимиты файлов.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUploadAttachURLRequest(data: GetUploadAttachURLData): Promise<Answer<UploadAttachResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<UploadAttachResult>("[message]: get upload attach url", data);

}
