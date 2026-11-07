// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения настроек конфиденциальности.
 ***************************************************************************
 */
export interface SavePrivacySettingsData {

    /** Кто видит звонки. */
    privacy_calls: string;

    /** Кто видит сообщения. */
    privacy_messages: string;

    /** Кто видит голосовые сообщения. */
    privacy_messages_voice: string;

    /** Кто может найти пользователя через поиск. */
    privacy_search_users: string;

    /**
     * Кто может передавать файлы. Клиент отправляет это поле, но сервер его
     * пока игнорирует (не входит в контракт сохранения).
     */
    privacy_sharing_files?: string;

}

/**
 * ***************************************************************************
 * Сохранение настроек конфиденциальности пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (коды PRIVACY_*_INVALID) пробрасывается
 *         без изменений.
 ***************************************************************************
 */
export async function savePrivacySettingsRequest(data: SavePrivacySettingsData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[user]: save privacy settings", data);

}
