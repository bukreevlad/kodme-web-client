// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StoreId } from "../../../utils/store.js";
import type { ChannelInvite, InviteDirection } from "../types.js";

/**
 * Данные запроса страницы списка приглашений канала.
 */
export interface ChannelGetInvitesData {

    /** Id канала. */
    channel_id: string;

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: InviteDirection | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница приглашений + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 * ***************************************************************************
 */
export interface ChannelInvitePage extends Answer<ChannelInvite[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка приглашений канала.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_invites.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей приглашений.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getInvitesRequest(data: ChannelGetInvitesData): Promise<ChannelInvitePage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelInvite[]>("[channel]: get invites", data);

}
