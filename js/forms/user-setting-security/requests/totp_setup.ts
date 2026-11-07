// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Полезная нагрузка ответа шага включения TOTP.
 */
export interface TotpSetupResponse {

    /** Секрет в base32. */
    secret: string;

    /** otpauth-URI для ручного добавления. */
    otpauth_url: string;

    /** QR-картинка (data-URL). */
    qr_image: string;

    /** Количество цифр кода. */
    digits: number;

    /** Шаг кода в секундах. */
    step: number;

}

/**
 * ***************************************************************************
 * Шаг включения TOTP: генерация неподтверждённого секрета и данных
 * для добавления в приложение-генератор (QR-картинка, otpauth-URI).
 * @returns Ответ сервера с секретом и QR-картинкой.
 * @throws Ошибка сокета/таймаута (включая коды USER_ID_*, ALREADY_ENABLED,
 *         DISABLED) пробрасывается без изменений.
 * ***************************************************************************
 */
export async function totpSetupRequest(): Promise<Answer<TotpSetupResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: totp setup", {});

}
