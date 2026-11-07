// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса удаления файла из облака.
 ***************************************************************************
 */
export interface RemoveFileData {

    /** Id файла. */
    item_id: string;

    /** Id ссылки (для общего доступа). */
    link_id?: string | null | undefined;

}

/**
 * Ответ сервера: id удалённого файла (клиент читает только успех).
 */
export interface RemoveFileResult {

    /** Id удалённого файла. */
    item_id: string;

}

/**
 * ***************************************************************************
 * Удаление файла из облака (мягкое, ссылки отзываются).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove_file.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeFileRequest(data: RemoveFileData): Promise<Answer<RemoveFileResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<RemoveFileResult>("[cloud]: remove file", data);

}
