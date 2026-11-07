// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { UserProfileRecord } from "../types.js";

/**
 * Данные запроса информации о пользователе.
 */
export interface UserInfoGetData {

    /** Id пользователя. */
    user_id: string;

}

/**
 * ***************************************************************************
 * Запрос информации о пользователе.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает его вызывающий код (_onBeforeOpen формы).
 * @param data - Данные запроса.
 * @returns Ответ сервера профилем пользователя.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getUserInfoRequest(data: UserInfoGetData): Promise<Answer<UserProfileRecord>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<UserProfileRecord>("[user]: get info", data);

}
