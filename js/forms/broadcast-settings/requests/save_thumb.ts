// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CastThumbnail } from "../../broadcasts/types.js";

/**
 * Данные запроса сохранения обложки трансляции.
 */
export interface BroadcastSaveThumbData {

    /** Id трансляции. */
    cast_id: string;

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Запрос сохранения обложки трансляции.
 * @param data - Данные запроса.
 * @returns Ответ сервера документом обложки.
 * @throws Error сервера — разбирает вызывающий код (choosePhoto).
 * ***************************************************************************
 */
export async function saveThumbRequest(data: BroadcastSaveThumbData): Promise<Answer<CastThumbnail>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CastThumbnail>("[broadcast]: save thumb", data);

}
