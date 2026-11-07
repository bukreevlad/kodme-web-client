// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { ChannelRecord } from "../types.js";

/**
 * Данные запроса страницы списка чатов пользователя.
 */
export interface GetUserConverstionData {

    /** Направление загрузки страницы. */
    direction: "prev" | "next";

    /** Id записи старта (отсутствует на первой странице). */
    cursor_id?: string;

    /** Размер порции элементов. */
    offset: number;

}

/**
 * ***************************************************************************
 * Запрос страницы списка чатов пользователя (каналы и их темы).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_conversations.ts).
 * @param data - Данные запроса.
 * @returns Порция каналов (у групп — вместе с темами).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUserConverstionRequest(data: GetUserConverstionData): Promise<Answer<ChannelRecord[]>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelRecord[]>("[channel]: get user conversations", data);

}
