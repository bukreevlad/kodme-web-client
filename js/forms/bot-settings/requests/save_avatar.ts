// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";

/**
 * Данные запроса сохранения аватара бота.
 */
export interface SaveBotAvatarData {

    /** Id бота. */
    bot_id: string;

    /** Id документа. */
    document_id: string;

}

/**
 * ***************************************************************************
 * Сохранение аватара бота.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/choose_photo.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера документом аватара.
 * @throws Ошибка сокета/таймаута (включая коды DOCUMENT_ID_REQUIRED,
 *         DOCUMENT_ID_INVALID, ACCESS_DENIED) пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveBotAvatarRequest(data: SaveBotAvatarData): Promise<Answer<AvatarImageDocument>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<AvatarImageDocument>("[bot]: save avatar", data);

}
