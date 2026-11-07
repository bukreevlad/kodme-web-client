// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";
import type { MeetBlocks } from "../../types.js";

/**
 * Данные запроса блокировки источников участника.
 */
export interface MuteParticipantData {

    /** Id конференции. */
    meet_id: string;

    /** Identity участника в комнате LiveKit. */
    participant_id: string;

    /** Итоговые флаги { audio, video, screen }. */
    blocks: MeetBlocks;

}

/**
 * ***************************************************************************
 * Задаёт блокировку микрофона / камеры / демонстрации экрана конкретному
 * участнику конференции (жёсткая блокировка).
 *
 * Сервис ждёт итоговые флаги, а не дельту. Модуль запроса только
 * отправляет запрос и пробрасывает ошибку наружу: разбирает её вызывающий
 * код (см. ../handlers/mute_participant.ts).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function muteParticipantRequest(data: MuteParticipantData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[meet]: mute participant", data);

}
