// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StoreId } from "../../../utils/store.js";
import type { BroadcastCast, BroadcastDirection } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка трансляций.
 ***************************************************************************
 */
export interface GetCastsData {

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: BroadcastDirection | null | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница трансляций + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 ***************************************************************************
 */
export interface BroadcastCastPage extends Answer<BroadcastCast[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка трансляций.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_casts.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей трансляций.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getCastsRequest(data: GetCastsData): Promise<BroadcastCastPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BroadcastCast[]>("[broadcast]: get casts", data);

}
