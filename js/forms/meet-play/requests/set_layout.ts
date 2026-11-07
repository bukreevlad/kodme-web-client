// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MeetLayout } from "../types.js";

/**
 * Данные запроса принудительного режима сетки.
 */
export interface SetLayoutParams {

    /** Id конференции. */
    meet_id: string;

    /** Режим: grid | spotlight | sidebar | presentation (null — снять режим). */
    layout: MeetLayout | null;

}

/**
 * Ответ сервера на смену принудительного режима сетки.
 */
export interface SetLayoutAnswer {

    /** Применённый режим (null — режим снят). */
    layout: MeetLayout | null;

}

/**
 * ***************************************************************************
 * Задаёт принудительный режим отображения сетки для всех участников
 * конференции (режим живёт в metadata комнаты LiveKit,
 * отдельный push не используется).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. meet-grid-settings/handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с применённым режимом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function setLayoutParams(data: SetLayoutParams): Promise<Answer<SetLayoutAnswer>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SetLayoutAnswer>("[meet]: set layout", data);

}
