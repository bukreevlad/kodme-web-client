// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StoreId } from "../../../utils/store.js";
import type { MeetDirection, MeetRecord } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка конференций.
 ***************************************************************************
 */
export interface GetMeetsData {

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: MeetDirection | null | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница конференций + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 ***************************************************************************
 */
export interface MeetPage extends Answer<MeetRecord[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка конференций.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_meets.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей конференций.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getMeetsRequest(data: GetMeetsData): Promise<MeetPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetRecord[]>("[meet]: get meets", data);

}
