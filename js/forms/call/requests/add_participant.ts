// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса приглашения участника в звонок.
 */
export interface AddParticipantData {

    /** Id звонка. */
    call_id: string | null;

    /** Id приглашаемого пользователя. */
    user_id: string;

}

/**
 * ***************************************************************************
 * Приглашение ещё одного участника в идущий звонок.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/add_participant.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера (без данных).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function addParticipantRequest(data: AddParticipantData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[call]: add participant", data);

}
