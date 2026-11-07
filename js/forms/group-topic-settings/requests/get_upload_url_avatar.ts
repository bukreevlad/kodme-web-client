// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudUploadTarget } from "../../cloud/requests/get_upload_file_url.js";

/**
 * Данные запроса пре-подписанного URL загрузки аватара темы группы.
 */
export interface GroupTopicUploadAvatarUrlData {

    /** Id канала. */
    channel_id: string;

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
export interface GroupTopicUploadAvatarUrlResult {

    /** Id документа (дальше идёт в "save avatar"). */
    document_id: string;

    /** Цели загрузки в S3 (оригинал плюс производные). */
    targets: CloudUploadTarget[];

}

/**
 * ***************************************************************************
 * Получение пре-подписанного URL для загрузки аватара темы группы в S3.
 * @param data - Данные запроса.
 * @returns Ответ сервера целями загрузки.
 * @throws Error сервера — разбирает вызывающий код (choosePhoto).
 * ***************************************************************************
 */
export async function getUploadAvatarUrlRequest(data: GroupTopicUploadAvatarUrlData): Promise<Answer<GroupTopicUploadAvatarUrlResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck("[group-topic]: get upload avatar url", data);

}
