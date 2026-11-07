// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания приглашения в трансляцию.
 */
export interface BroadcastInviteCreateData {

    /** Id трансляции. */
    cast_id: string;

    /** Название приглашения. */
    name: string;

    /** Лимит использований; 0 — без лимита. */
    max_users: number;

}

/**
 * Ответ сервера: созданный инвайт (объект Invite; форма читает только статус).
 */
export interface BroadcastInviteCreateResponse {

    /** Id приглашения. */
    id: string;

    /** Название приглашения. */
    name: string;

    /** Значение ссылки-приглашения. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос создания приглашения в трансляцию.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданным инвайтом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: BroadcastInviteCreateData): Promise<Answer<BroadcastInviteCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<BroadcastInviteCreateResponse>("[broadcast]: create invite", data);

}
