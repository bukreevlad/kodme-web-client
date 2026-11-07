// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса второго шага регистрации ключа доступа.
 */
export interface PasskeyRegisterFinishRequestData {

    /** Идентификатор ceremony из первого шага. */
    ceremony_id: string;

    /** clientDataJSON в base64url. */
    client_data: string;

    /** attestationObject в base64url. */
    attestation_object: string;

    /** Перевозки аутентификатора из ответа браузера. */
    transports?: string[] | undefined;

    /** Человекочитаемое имя ключа. */
    name?: string | undefined;

}

/**
 * ***************************************************************************
 * Второй шаг регистрации ключа доступа: проверка ответа аутентификатора
 * и сохранение credential'а.
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды CEREMONY_*, DUPLICATE,
 *         LIMIT_REACHED, RESPONSE_INVALID) пробрасывается без изменений.
 * ***************************************************************************
 */
export async function passkeyRegisterFinishRequest(data: PasskeyRegisterFinishRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: passkey register finish", data);

}
