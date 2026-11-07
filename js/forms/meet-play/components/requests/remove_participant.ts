// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса исключения участника конференции.
 */
export interface RemoveParticipantData {

    /** Id конференции. */
    meet_id: string;

    /** Identity участника в комнате LiveKit. */
    participant_id: string;

}

/**
 * ***************************************************************************
 * Исключает участника конференции. Трансляции (`cast-<cast_id>`) сервер
 * снимает сам, разбирая identity.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. ../handlers/remove.ts).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeParticipantRequest(data: RemoveParticipantData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[meet]: remove participant", data);

}
