// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { MemberPage, MemberPaginationDirection, MemberRecord } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка участников канала.
 * ***************************************************************************
 */
export interface GetMembersData {

    /** Id канала. */
    channel_id: string;

    /** Направление загрузки: отсутствует — первая страница. */
    direction?: MemberPaginationDirection | undefined;

    /** Id записи старта (UUID крайнего элемента запрошенного направления). */
    cursor_id?: string | undefined;

    /** Количество записей. */
    offset: number;

}

/**
 * ***************************************************************************
 * Запрос страницы списка участников канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_members.ts).
 * @param data - Данные запроса.
 * @returns Страница списка участников с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getMembersRequest(data: GetMembersData): Promise<MemberPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MemberRecord[]>("[channel-member]: get members", data);

}
