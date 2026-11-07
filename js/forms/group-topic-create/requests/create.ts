// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса создания темы группы.
 */
export interface GroupTopicCreateData {

    /** Id родительской группы. */
    group_id: string;

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
 * Ответ сервера: id созданной темы.
 */
export interface GroupTopicCreateResponse {

    /** Id темы. */
    channel_id: string;

}

/**
 * ***************************************************************************
 * Запрос создания темы группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера с id созданной темы.
 * @throws Error сервера — разбирает вызывающий код (createHandler).
 * ***************************************************************************
 */
export async function createRequest(data: GroupTopicCreateData): Promise<Answer<GroupTopicCreateResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group-topic]: create", data);

}
