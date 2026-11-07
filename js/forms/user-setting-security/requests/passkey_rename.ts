// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса переименования ключа доступа.
 */
export interface PasskeyRenameRequestData {

    /** Идентификатор credential'а (base64url). */
    credential_id: string;

    /** Новое имя ключа. */
    name: string;

}

/**
 * ***************************************************************************
 * Переименование ключа доступа.
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды CREDENTIAL_ID_*,
 *         NAME_*, NOT_FOUND) пробрасывается без изменений.
 * ***************************************************************************
 */
export async function passkeyRenameRequest(data: PasskeyRenameRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: passkey rename", data);

}
