// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MeetBlockRecord } from "../types.js";

/**
 * Данные запроса массовой блокировки источников.
 */
export interface MuteAllParticipantsData {

    /** Id конференции. */
    meet_id: string;

    /** Флаги { audio, video, screen }: не переданный флаг сохраняется как есть. */
    blocks: MeetBlockRecord;

}

/**
 * Ответ сервера с фактически применённым состоянием.
 */
export interface MuteAllParticipantsAnswer {

    /** Identity участников, которых реально затронуло действие. */
    applied: string[];

    /** Итоговое правило комнаты. */
    defaults: MeetBlockRecord;

    /** Область применения ("room" — правило комнаты). */
    scope: string;

}

/**
 * ***************************************************************************
 * Задаёт одинаковую блокировку микрофона / камеры / демонстрации экрана
 * сразу всем участникам конференции (правило комнаты).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/mute_all_participants.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с фактически применённым состоянием.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function muteAllParticipantsRequest(
    data: MuteAllParticipantsData
): Promise<Answer<MuteAllParticipantsAnswer>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<MuteAllParticipantsAnswer>("[meet]: mute all participants", data);

}
