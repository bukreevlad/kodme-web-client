// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания группы.
 */
export interface GroupCreateData {

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная/Закрытая. */
    is_public: boolean;

    /** Кто может публиковать. */
    is_posting: boolean;

}

/**
 * Ответ сервера: id созданной группы.
 */
export interface GroupCreateResponse {

    /** Id группы. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера с id созданной группы.
 * @throws Error сервера — разбирает вызывающий код (createHandler).
 * ***************************************************************************
 */
export async function createRequest(data: GroupCreateData): Promise<Answer<GroupCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: create", data);

}
