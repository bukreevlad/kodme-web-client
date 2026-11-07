// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания приложения бота.
 */
export interface CreateBotAppData {

    /** Id бота. */
    bot_id: string;

    /** Название приложения. */
    name: string;

    /** Короткая ссылка приложения. */
    link: string | null;

    /** Описание приложения. */
    about: string | null;

    /** URL адрес приложения. */
    url: string;

}

/**
 * ***************************************************************************
 * Создание приложения бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/add.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function addAppRequest(data: CreateBotAppData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[bots-apps]: create", data);

}
