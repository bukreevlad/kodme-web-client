// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса удаления папки из облака.
 ***************************************************************************
 */
export interface RemoveFolderData {

    /** Id папки. */
    item_id: string;

    /** Id ссылки (для общего доступа). */
    link_id?: string | null | undefined;

}

/**
 * Ответ сервера: id удалённой папки (клиент читает только успех).
 */
export interface RemoveFolderResult {

    /** Id удалённой папки. */
    item_id: string;

}

/**
 * ***************************************************************************
 * Удаление папки вместе со всем содержимым (мягкое).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/remove_folder.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function removeFolderRequest(data: RemoveFolderData): Promise<Answer<RemoveFolderResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<RemoveFolderResult>("[cloud]: remove folder", data);

}
