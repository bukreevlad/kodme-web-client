// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса установки ссылки канала.
 */
export interface ChannelSettingLinkSaveData {

    /** Id канала. */
    channel_id: string;

    /** Ссылка. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос установки публичной ссылки канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function saveRequest(data: ChannelSettingLinkSaveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[channel]: save link", data);

}
