// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подписки на канал по приглашению.
 */
export interface SubscribeChannelWithInviteData {

    /** Id канала. */
    channel_id: string;

    /** Ссылка-приглашение (сервер отвечает INVITE_REQUIRED, если её нет). */
    invite?: string | undefined;

}

/**
 * ***************************************************************************
 * Подписка на канал по ссылке-приглашению.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/open.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function subscribeWithInviteRequest(data: SubscribeChannelWithInviteData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[channel-member]: subscribe with invite", data);

}
