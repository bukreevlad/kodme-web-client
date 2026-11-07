// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания приглашения в конференцию.
 */
export interface MeetInviteCreateData {

    /** Id конференции. */
    meet_id: string;

    /** Название приглашения. */
    name: string;

    /** Лимит использований; 0 — без лимита. */
    max_users: number;

}

/**
 * Ответ сервера: созданный инвайт (объект Invite; форма читает только статус).
 */
export interface MeetInviteCreateResponse {

    /** Id приглашения. */
    id: string;

    /** Название приглашения. */
    name: string;

    /** Значение ссылки-приглашения. */
    link: string;

}

/**
 * ***************************************************************************
 * Запрос создания приглашения в конференцию.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданным инвайтом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createRequest(data: MeetInviteCreateData): Promise<Answer<MeetInviteCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetInviteCreateResponse>("[meet]: create invite", data);

}
