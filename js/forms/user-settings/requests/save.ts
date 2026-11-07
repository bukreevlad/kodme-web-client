// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { SessionUserFields } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения настроек пользователя.
 ***************************************************************************
 */
export interface SaveSettingsData {

    /** Имя. */
    first_name: string;

    /** Фамилия. */
    last_name: string;

    /** О себе. */
    bio: string;

}

/**
 * Полезная нагрузка ответа: обновлённые поля профиля.
 */
export type SaveSettingsResponse = Pick<SessionUserFields, "first_name" | "last_name" | "display_name" | "bio">;

/**
 * ***************************************************************************
 * Сохранение настроек пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера обновлёнными полями профиля.
 * @throws Ошибка сокета/таймаута (включая коды FIRST_NAME_REQUIRED,
 *         FIRST_NAME_INVALID, LAST_NAME_INVALID, BIO_INVALID)
 *         пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveSettingsRequest(data: SaveSettingsData): Promise<Answer<SaveSettingsResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SaveSettingsResponse>("[user]: save settings", data);

}
