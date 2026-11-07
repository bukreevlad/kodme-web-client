// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса смены пароля пользователя.
 ***************************************************************************
 */
export interface SetPasswordData {

    /** Текущий пароль. */
    old_password: string;

    /** Новый пароль. */
    new_password: string;

    /** Повтор нового пароля. */
    retry_password: string;

    /** Выйти на других устройствах. */
    is_exit_other_sessions: boolean;

}

/**
 * ***************************************************************************
 * Смена пароля пользователя.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды OLD_PASSWORD_REQUIRED,
 *         OLD_PASSWORD_NOT_MATCH, NEW_PASSWORD_REQUIRED, NEW_PASSWORD_TOO_SHORT,
 *         RETRY_PASSWORD_REQUIRED, PASSWORDS_NOT_MATCH) пробрасывается без
 *         изменений.
 ***************************************************************************
 */
export async function setPasswordRequest(data: SetPasswordData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[user]: set password", data);

}
