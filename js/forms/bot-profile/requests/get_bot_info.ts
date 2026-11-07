// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем components
import type { AvatarImageDocument } from "../../../components/avatars.js";

// Импортируем utils
import type { StoreItem } from "../../../utils/store.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса информации о боте.
 ***************************************************************************
 */
export interface GetBotInfoData {

    /** Id бота. */
    bot_id: string;

}

/**
 * Приложение бота в ответе "[bot]: get info" (строка bots_apps;
 * из формы читаются только id и название).
 */
export interface BotAppItem extends StoreItem {

    /** Id приложения (UUID v7). */
    id: string;

    /** Название приложения. */
    name: string;

    /** Отображённые копии элемента в списке приложений. */
    __domElements__?: HTMLElement[];

}

/**
 * ***************************************************************************
 * Бот — полезная нагрузка ответа "[bot]: get info".
 *
 * Поля — только те, что реально читает форма bot-profile (шапка, кнопка
 * «Настройки», диалог приложений). Аватар бота сервер возвращает
 * как токенизированный документ (null — аватара нет).
 ***************************************************************************
 */
export interface BotInfo {

    /** Id бота (UUID v7). */
    id: string;

    /** Описание бота (null — пусто). */
    bio: string | null;

    /** Id пользователя, создавшего бота (владелец видит «Настройки»). */
    bot_created_user_id: string;

    /** Публичная ссылка бота (null — ссылка ещё не выдана). */
    link: string | null;

    /** Аватар бота (null — аватара нет). */
    avatar?: AvatarImageDocument | null;

    /** Приложения бота. */
    apps: BotAppItem[];

}

/**
 * ***************************************************************************
 * Guard: похож ли payload события стора на приложение бота.
 * @param payload - Полезная нагрузка события стора.
 * @returns Да, если это приложение с id и названием.
 ***************************************************************************
 */
export function isBotAppItem(payload: unknown): payload is BotAppItem {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        "name" in payload;
}

/**
 * ***************************************************************************
 * Запрос информации о боте.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts, _onBeforeOpen).
 * @param data - Данные запроса.
 * @returns Ответ сервера информацией о боте.
 * @throws Ошибка сокета/таймаута (включая код INVALID_BOT_ID)
 *         пробрасывается без изменений.
 ***************************************************************************
 */
export async function getBotInfoRequest(data: GetBotInfoData): Promise<Answer<BotInfo>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BotInfo>("[bot]: get info", data);

}
