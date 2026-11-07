// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса перемещения канала в папку.
 */
export interface MoveToFolderData {

    /** Id канала. */
    channel_id: string;

    /** Id папки. */
    main_folder_id: string;

}

/**
 * ***************************************************************************
 * Переместить канал в папку.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function moveToFolderRequest(data: MoveToFolderData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[main]: move channel to folder", data);

}
