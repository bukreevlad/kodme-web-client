// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подтверждения включения TOTP.
 */
export interface TotpConfirmRequestData {

    /** Код из приложения-генератора. */
    code: string;

}

/**
 * Полезная нагрузка ответа подтверждения TOTP.
 */
export interface TotpConfirmResponse {

    /** TOTP подтверждён. */
    enabled: boolean;

}

/**
 * ***************************************************************************
 * Подтверждение включения TOTP вводом актуального кода.
 * @param data - Данные запроса.
 * @returns Ответ сервера с флагом включения.
 * @throws Ошибка сокета/таймаута (включая коды CODE_*, TOO_MANY_ATTEMPTS)
 *         пробрасывается без изменений.
 * ***************************************************************************
 */
export async function totpConfirmRequest(data: TotpConfirmRequestData): Promise<Answer<TotpConfirmResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: totp confirm", data);

}
