// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания темы оформления.
 */
export interface CreateThemeRequestData {

    /** Название темы. */
    name: string;

    /** CSS-стили темы. */
    style: string;

    /** Публичная (видна всем) или закрытая тема. */
    is_public: boolean;

}

/**
 * ***************************************************************************
 * Запрос создания темы оформления.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createThemeRequest(data: CreateThemeRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[theme]: create", data);

}
