// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudFilePayload } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения загруженного файла в облако.
 ***************************************************************************
 */
export interface SaveFileData {

    /** Id папки из "get upload file url" (эхом). */
    folder_id?: string | null;

    /** Id ссылки (для общего доступа, сервер повторно проверит право записи). */
    link_id?: string | null;

    /** Id документа из "get upload file url". */
    document_id: string;

}

/**
 * Строка cloud_items в ответе "save file" (клиент читает поля элемента).
 */
export interface CloudSavedItem {

    /** Id созданного элемента. */
    id: string;

    /** Id родительской папки (null — корень). */
    parent_id?: string | null;

    /** Имя элемента. */
    name?: string;

    /** Id документа в storage. */
    document_id?: string;

    /** Дата создания (ISO-строка). */
    created_at?: string;

}

/**
 * Ответ сервера: созданный элемент облака и данные файла.
 */
export interface SaveFileResult {

    /** Элемент облака. */
    item: CloudSavedItem;

    /** Данные файла (token-payload). */
    file: CloudFilePayload;

}

/**
 * ***************************************************************************
 * Сохранение загруженного файла в облако.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/upload_files.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданным элементом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveFileRequest(data: SaveFileData): Promise<Answer<SaveFileResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<SaveFileResult>("[cloud]: save file", data);

}
