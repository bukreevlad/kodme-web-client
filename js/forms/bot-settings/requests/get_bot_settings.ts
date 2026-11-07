// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { BotSettingsProfile } from "../types.js";

/**
 * Данные запроса настроек бота.
 */
export interface GetBotSettingsData {

    /** Id бота. */
    bot_id: string;

}

/**
 * ***************************************************************************
 * Получение настроек бота владельцем: профиль, команды меню, приложения
 * и секретный токен.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts, `_onBeforeOpen`).
 * @param data - Данные запроса.
 * @returns Ответ сервера настройками бота.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getBotSettingsRequest(data: GetBotSettingsData): Promise<Answer<BotSettingsProfile>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BotSettingsProfile>("[bot]: get settings", data);

}
