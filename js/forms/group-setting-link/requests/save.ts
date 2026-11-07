// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса установки ссылки группы.
 */
export interface GroupSettingLinkData {

    /** Id канала. */
    channel_id: string;

    /** Ссылка. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос установки публичной ссылки группы.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveRequest(data: GroupSettingLinkData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: save link", data);

}
