// Импортируем config
import { Socket } from "../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_UPLOAD } from "../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Полезная нагрузка ответа сервера на отмену загрузки документа.
 */
export interface AbortUploadData {

    /** Новый статус записи. */
    status: "aborted";

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Отменить загрузку документа на сервере.
 *
 * Вызывается, когда пользователь прервал загрузку (кнопка отмены на
 * прогресс-баре). Запись переходит в терминальный статус `aborted`, и
 * сервер перестаёт ждать объекты S3. Best-effort: если сокет уже закрылся,
 * запрос не уйдёт — это не ошибка, запись подчистит TTL.
 * @param data - Данные.
 * @param data.document_id - Id документа.
 * @returns Ответ сервера в конверте `{ data: { status, document_id }, status: true }`.
 * ***************************************************************************
 */
export async function abortUpload(data: { document_id?: string }): Promise<Answer<AbortUploadData>> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_UPLOAD)
        .emitWithAck<AbortUploadData>("[storage]: abort upload", data);

}
