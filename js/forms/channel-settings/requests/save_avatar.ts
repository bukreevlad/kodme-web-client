// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";

/**
 * Данные запроса сохранения аватара канала.
 */
export interface ChannelSaveAvatarData {

    /** Id канала. */
    channel_id: string;

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Запрос сохранения аватара канала.
 * @param data - Данные запроса.
 * @returns Ответ сервера документом аватара.
 * @throws Error сервера — разбирает вызывающий код (choosePhoto).
 * ***************************************************************************
 */
export async function saveAvatarRequest(data: ChannelSaveAvatarData): Promise<Answer<AvatarImageDocument>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<AvatarImageDocument>("[channel]: save avatar", data);

}
