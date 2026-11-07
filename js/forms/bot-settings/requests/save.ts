// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек бота.
 */
export interface SaveBotSettingsData {

    /** Id бота. */
    bot_id: string;

    /** Описание бота. */
    bio: string;

    /** Команды меню бота в JSON-строке. */
    commands: string;

}

/**
 * ***************************************************************************
 * Сохранение описания и меню бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveRequest(data: SaveBotSettingsData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bot]: save settings", data);

}
