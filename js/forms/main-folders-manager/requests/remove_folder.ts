// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления папки.
 */
export interface MainRemoveFolderData {

    /** Id удаляемой папки. */
    folder_id: string;

}

/**
 * ***************************************************************************
 * Запрос удаления папки пользователя.
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (removeFolderHandler).
 * ***************************************************************************
 */
export async function removeFolderRequest(data: MainRemoveFolderData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[main]: remove folder", data);

}
