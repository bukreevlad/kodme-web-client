// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса нажатия инлайн-кнопки.
 */
export interface MessageButtonClickData {

    /** Id канала. */
    channel_id: string;

    /** Id сообщения. */
    message_id: string;

    /** Id кнопки. */
    button_id?: string | undefined;

    /** Состояние кнопки. */
    state?: string | undefined;

    /** Id бота. */
    bot_id?: string | undefined;

}

/**
 * ***************************************************************************
 * Нажать инлайн-кнопку сообщения (от бота).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Ответ сервера без данных.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function messageButtonClickRequest(data: MessageButtonClickData): Promise<Answer<undefined>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<undefined>("[message]: click button", data);

}
