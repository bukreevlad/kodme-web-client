// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса отзыва приглашения конференции.
 * ***************************************************************************
 */
export interface MeetRemoveInviteData {

    /** Id конференции. */
    meet_id: string;

    /** Id приглашения. */
    invite_id: string;

}

/**
 * ***************************************************************************
 * Отзыв приглашения конференции: ссылка перестаёт действовать.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. components/handlers/remove_invite.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды INVITE_*, ACCESS_DENIED)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeInviteRequest(data: MeetRemoveInviteData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[meet]: remove invite", data);

}
