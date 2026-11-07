// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса принудительного фокуса.
 */
export interface SetFocusData {

    /** Id конференции. */
    meet_id: string;

    /** true — показать организатора крупно у всех участников. */
    focus: boolean;

}

/**
 * Ответ сервера на смену принудительного фокуса.
 */
export interface SetFocusAnswer {

    /** Identity крупной плитки у всех (null — фокус снят). */
    focus: string | null;

}

/**
 * ***************************************************************************
 * Делает организатора крупной плиткой у всех участников конференции.
 *
 * Как и принудительный режим сетки, правило живёт в metadata комнаты
 * LiveKit и разлетается всем через `RoomMetadataChanged` — отдельный
 * сокет-push не используется.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. meet-grid-settings/handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера с применённым фокусом.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function setFocusRequest(data: SetFocusData): Promise<Answer<SetFocusAnswer>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SetFocusAnswer>("[meet]: set focus", data);

}
