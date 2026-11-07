// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { ChannelUpdateItem } from "../types.js";

/**
 * Точка отсчёта одного канала: id и последний применённый PTS.
 */
export interface GetUpdatesChannelPoint {

    /** Id канала (UUID v7). */
    id: string;

    /** Последний применённый клиентом PTS канала. */
    pts: number;

}

/**
 * Данные запроса догоняющих обновлений.
 */
export interface GetUpdatesData {

    /** Точки отсчёта всех каналов пользователя. */
    channels: GetUpdatesChannelPoint[];

    /** Размер порции элементов. */
    offset: number;

}

/**
 * Полезная нагрузка ответа: пакет обновлений и признак продолжения.
 */
export interface GetUpdatesPayload {

    /** Обновления всех каналов в порядке возрастания PTS. */
    items: ChannelUpdateItem[];

    /** Пакет заполнил лимит — у сервера есть ещё данные. */
    has_more: boolean;

}

/**
 * ***************************************************************************
 * Запрос догоняющих обновлений (поканальная PTS-логика).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_updates.ts).
 * @param data - Данные запроса.
 * @returns Пакет обновлений с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUpdatesRequest(data: GetUpdatesData): Promise<Answer<GetUpdatesPayload>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GetUpdatesPayload>("[channel]: get updates", data);

}
