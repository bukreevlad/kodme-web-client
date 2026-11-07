// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса добавления пользователя в контакты.
 */
export interface AddContactData {

    /** Id добавляемого пользователя. */
    contact_user_id: string;

}

/**
 * ***************************************************************************
 * Запрос добавления пользователя в контакты.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/context_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера (пустой при успехе).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function addContactRequest(data: AddContactData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[contact]: add", data);

}
