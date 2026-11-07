// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления пользователя из контактов.
 */
export interface RemoveContactData {

    /** Id удаляемого пользователя. */
    contact_user_id: string;

}

/**
 * ***************************************************************************
 * Запрос удаления пользователя из контактов.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/context_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера (пустой при успехе).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function removeContactRequest(data: RemoveContactData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[contact]: remove", data);

}
