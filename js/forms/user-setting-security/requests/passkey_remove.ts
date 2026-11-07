// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления ключа доступа.
 */
export interface PasskeyRemoveRequestData {

    /** Идентификатор credential'а (base64url). */
    credential_id: string;

}

/**
 * ***************************************************************************
 * Удаление (отзыв) ключа доступа.
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды CREDENTIAL_ID_*,
 *         NOT_FOUND) пробрасывается без изменений.
 * ***************************************************************************
 */
export async function passkeyRemoveRequest(data: PasskeyRemoveRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: passkey remove", data);

}
