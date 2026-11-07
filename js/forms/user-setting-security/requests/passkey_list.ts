// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { PasskeyListItem } from "../types.js";

/**
 * ***************************************************************************
 * Список зарегистрированных ключей доступа пользователя.
 * @returns Ответ сервера со списком ключей.
 * @throws Ошибка сокета/таймаута (включая коды USER_ID_*, DISABLED)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function passkeyListRequest(): Promise<Answer<PasskeyListItem[]>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: passkey list", {});

}
