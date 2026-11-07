// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MeetThumbnail } from "../../meets/types.js";

/**
 * Данные запроса сохранения обложки конференции.
 */
export interface MeetSaveThumbData {

    /** Id конференции. */
    meet_id: string;

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Запрос сохранения обложки конференции.
 * @param data - Данные запроса.
 * @returns Ответ сервера документом обложки (id, token, metadata).
 * @throws Error сервера — разбирает вызывающий код (choosePhoto).
 * ***************************************************************************
 */
export async function saveThumbRequest(data: MeetSaveThumbData): Promise<Answer<MeetThumbnail>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MeetThumbnail>("[meet]: save thumb", data);

}
