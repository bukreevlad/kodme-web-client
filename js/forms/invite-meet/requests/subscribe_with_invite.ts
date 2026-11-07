// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подписки на конференцию по приглашению.
 */
export interface SubscribeMeetWithInviteData {

    /** Id конференции. */
    meet_id: string;

    /** Ссылка-приглашение. */
    invite: string;

}

/**
 * ***************************************************************************
 * Подписка на конференцию по ссылке-приглашению.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/open.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function subscribeWithInviteRequest(data: SubscribeMeetWithInviteData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[meet-member]: subscribe with invite", data);

}
