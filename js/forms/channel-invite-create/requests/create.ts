// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания приглашения в канал.
 */
export interface ChannelInviteCreateData {

    /** Id канала. */
    channel_id: string;

    /** Название приглашения. */
    name: string;

    /** Лимит использований; 0 — без лимита. */
    max_users: number;

}

/**
 * Ответ сервера: созданный инвайт (объект Invite; форма читает только статус).
 */
export interface ChannelInviteCreateResponse {

    /** Id приглашения. */
    id: string;

    /** Название приглашения. */
    name: string;

    /** Значение ссылки-приглашения. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос создания приглашения в канал.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданным инвайтом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: ChannelInviteCreateData): Promise<Answer<ChannelInviteCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ChannelInviteCreateResponse>("[channel]: create invite", data);

}
