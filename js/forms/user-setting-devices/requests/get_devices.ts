// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StoreId } from "../../../utils/store.js";
import type { SessionListItem, DeviceDirection } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка сессий (устройств).
 ***************************************************************************
 */
export interface GetSessionsData {

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: DeviceDirection | null | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница сессий + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 ***************************************************************************
 */
export interface SessionListPage extends Answer<SessionListItem[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка сессий (устройств).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_devices.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей сессий.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getSessionsRequest(data: GetSessionsData): Promise<SessionListPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SessionListItem[]>("[session]: get sessions", data);

}
