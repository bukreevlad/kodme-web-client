// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Настройки уведомлений пользователя (строка БД из ответа сервера).
 */
export interface NotifySettingsData {

    /** Уведомлять о действиях с аккаунтом. */
    notify_action_accounts: boolean;

    /** Уведомлять о звонках. */
    notify_calls: boolean;

    /** Уведомлять о новых сообщениях. */
    notify_messages: boolean;

    /** Уведомлять о новых комментариях. */
    notify_comments: boolean;

    /** Уведомлять об ответах на сообщения. */
    notify_reply_message: boolean;

}

/**
 * ***************************************************************************
 * Получение настроек уведомлений пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts).
 * @returns Ответ сервера настройками (data может быть undefined, если
 *          пользователь не найден).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getNotifySettingsRequest(): Promise<Answer<NotifySettingsData | undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<NotifySettingsData | undefined>("[user]: get notify settings");

}
