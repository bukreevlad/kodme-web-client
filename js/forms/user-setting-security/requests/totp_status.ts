// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { TotpStatusData } from "../types.js";

/**
 * ***************************************************************************
 * Статус двухфакторной авторизации TOTP.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/*).
 * @returns Ответ сервера со статусом TOTP.
 * @throws Ошибка сокета/таймаута (включая коды USER_ID_*, DISABLED)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function totpStatusRequest(): Promise<Answer<TotpStatusData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: totp status", {});

}
