// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса отключения TOTP.
 */
export interface TotpDisableRequestData {

    /** Действующий код из приложения-генератора. */
    code: string;

}

/**
 * Полезная нагрузка ответа отключения TOTP.
 */
export interface TotpDisableResponse {

    /** TOTP отключён. */
    enabled: boolean;

}

/**
 * ***************************************************************************
 * Отключение TOTP под действующим кодом.
 * @param data - Данные запроса.
 * @returns Ответ сервера с флагом отключения.
 * @throws Ошибка сокета/таймаута (включая коды CODE_*, TOO_MANY_ATTEMPTS)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function totpDisableRequest(data: TotpDisableRequestData): Promise<Answer<TotpDisableResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: totp disable", data);

}
