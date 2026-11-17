// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { UserFeedEvent } from "../../../types/domain.js";

/**
 * Данные запроса догоняющих обновлений личной ленты.
 */
export interface GetUserUpdatesData {

    /** Последний применённый upid личной ленты. */
    upid: number;

    /** Размер порции элементов. */
    offset: number;

}

/**
 * Полезная нагрузка ответа: пакет событий личной ленты и состояние.
 */
export interface GetUserUpdatesPayload {

    /** События личной ленты в порядке возрастания upid. */
    items: UserFeedEvent[];

    /** Пакет заполнил лимит — у сервера есть ещё данные. */
    has_more: boolean;

    /** Точка отрезана лентой — перечитать список каналов целиком. */
    too_long: boolean;

    /** Текущий upid сервера (прыжок после too_long). */
    upid: number;

}

/**
 * ***************************************************************************
 * Запрос догоняющих обновлений личной ленты (появление/исчезновение каналов).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_user_updates.ts).
 * @param data - Данные запроса.
 * @returns Пакет событий с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUserUpdatesRequest(data: GetUserUpdatesData): Promise<Answer<GetUserUpdatesPayload>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GetUserUpdatesPayload>("[user]: get updates", data);

}
