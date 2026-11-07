// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения настроек уведомлений.
 ***************************************************************************
 */
export interface SaveNotifySettingsData {

    /** Действия с аккаунтом. */
    action_accounts: boolean;

    /** Звонки. */
    calls: boolean;

    /** Новые сообщения. */
    messages: boolean;

    /** Новые комментарии. */
    comments: boolean;

    /** Ответы на сообщения. */
    reply_message: boolean;

}

/**
 * ***************************************************************************
 * Сохранение настроек уведомлений пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (коды USER_ID_*) пробрасывается без
 *         изменений.
 ***************************************************************************
 */
export async function saveNotifySettingsRequest(data: SaveNotifySettingsData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[user]: save notify settings", data);

}
