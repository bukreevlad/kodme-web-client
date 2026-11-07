// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_CAST } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса добавления трансляции в конференцию.
 */
export interface AddCastToMeetData {

    /** Id конференции. */
    meet_id: string;

    /** Id трансляции. */
    cast_id: string;

}

/**
 * ***************************************************************************
 * Добавляет трансляцию (cast) в конференцию: сервер подключает трансляцию
 * к комнате через WHIP Ingress.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/add_cast_to_meet.ts).
 * @param data - Данные запроса.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function addCastToMeetRequest(data: AddCastToMeetData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_CAST)
        .emitWithAck("[meet]: add cast to meet", data);

}
