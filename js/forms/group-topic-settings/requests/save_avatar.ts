// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";

/**
 * Данные запроса сохранения аватара темы группы.
 */
export interface GroupTopicSaveAvatarData {

    /** Id канала. */
    channel_id: string;

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Запрос сохранения аватара темы группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера документом аватара.
 * @throws Error сервера — разбирает вызывающий код (choosePhoto).
 * ***************************************************************************
 */
export async function saveAvatarRequest(data: GroupTopicSaveAvatarData): Promise<Answer<AvatarImageDocument>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group-topic]: save avatar", data);

}
