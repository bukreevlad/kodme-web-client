// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Настройки конфиденциальности пользователя (строка БД из ответа сервера).
 */
export interface PrivacySettingsData {

    /** Кто видит звонки. */
    privacy_calls: string;

    /** Кто видит сообщения. */
    privacy_messages: string;

    /** Кто видит голосовые сообщения. */
    privacy_messages_voice: string;

    /** Кто может найти пользователя через поиск. */
    privacy_search_users: string;

    /**
     * Кто может передавать файлы. NOTE: сервер пока не возвращает это поле
     * (колонка есть в БД, но не выбирается в SELECT) — поэтому оно
     * необязательное, а блок «Передача файлов» в форме отключён.
     */
    privacy_sharing_files?: string;

}

/**
 * ***************************************************************************
 * Получение настроек конфиденциальности пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts).
 * @returns Ответ сервера настройками (data может быть undefined, если
 *          пользователь не найден).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getPrivacySettingsRequest(): Promise<Answer<PrivacySettingsData | undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<PrivacySettingsData | undefined>("[user]: get privacy settings");

}
