// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { WebauthnCreationOptionsJson } from "../../../utils/helpers/webauthn.js";

/**
 * Полезная нагрузка ответа первого шага регистрации ключа доступа.
 */
export interface PasskeyRegisterBeginResponse {

    /** Идентификатор ceremony. */
    ceremony_id: string;

    /** Опции для navigator.credentials.create. */
    options: WebauthnCreationOptionsJson;

}

/**
 * ***************************************************************************
 * Первый шаг регистрации ключа доступа: одноразовый challenge и опции
 * создания credential'а.
 * @returns Ответ сервера с ceremony и опциями создания.
 * @throws Ошибка сокета/таймаута (включая коды USER_ID_*, LIMIT_REACHED,
 *         DISABLED) пробрасывается без изменений.
 * ***************************************************************************
 */
export async function passkeyRegisterBeginRequest(): Promise<Answer<PasskeyRegisterBeginResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[security]: passkey register begin", {});

}
