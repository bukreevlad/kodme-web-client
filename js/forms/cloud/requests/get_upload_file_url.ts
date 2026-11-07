// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Цель загрузки в S3 из ответа сервера (presigned POST policy).
 * Поля совпадают с контрактом uploadDerivedAssets.
 */
export interface CloudUploadTarget {

    /** Путь объекта в S3. */
    path: string;

    /** Роль объекта (original | thumbnail | rendition). */
    kind?: string;

    /** Ширина превью/рендерации. */
    width?: number;

    /** Метка рендеринга качества. */
    label?: string;

    /** URL бакета. */
    url?: string;

    /** Поля presigned POST политики. */
    fields?: Record<string, string>;

    /** MIME-тип объекта. */
    mime_type?: string;

    /** Максимальный размер объекта. */
    max_size?: number;

}

/**
 * ***************************************************************************
 * Данные запроса пре-подписанного URL загрузки файла.
 ***************************************************************************
 */
export interface GetUploadFileUrlData {

    /** Id папки, в которую загружается файл. */
    folder_id?: string | null;

    /** Id ссылки (нужен уровень доступа "write"). */
    link_id?: string | null;

    /** Оригинальное имя файла. */
    file_name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Размер файла в байтах. */
    size: number;

}

/**
 * Цели загрузки и документ для сохранения в облако.
 */
export interface GetUploadFileUrlResult {

    /** Id документа (дальше идёт в "save file"). */
    document_id: string;

    /** Id папки (эхом — в "save file"). */
    folder_id: string | null;

    /** Цели загрузки в S3 (оригинал плюс производные). */
    targets: CloudUploadTarget[];

}

/**
 * ***************************************************************************
 * Получение пре-подписанного URL для загрузки файла в S3.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/upload_files.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера целями загрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getUploadFileUrlRequest(data: GetUploadFileUrlData): Promise<Answer<GetUploadFileUrlResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<GetUploadFileUrlResult>("[cloud]: get upload file url", data);

}
