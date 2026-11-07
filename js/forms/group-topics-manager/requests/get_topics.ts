// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { GroupTopicRecord } from "../types.js";

/**
 * Данные запроса страницы списка тем группы.
 */
export interface GroupTopicsGetData {

    /** Id канала (группы). */
    channel_id?: string;

    /** Направление загрузки ["prev" | "next"] — отсутствует: первая страница. */
    direction?: "prev" | "next" | undefined;

    /** Id крайней записи, с которой начинать выборку. */
    cursor_id?: string | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * Ответ сервера: страница списка тем плюс признак продолжения в запрошенном
 * направлении (has_more добавлен поверх Answer).
 */
export interface GroupTopicsPage extends Answer<GroupTopicRecord[]> {

    /** Есть ли записи в запрошенном направлении. */
    has_more?: boolean;

}

/**
 * ************************************************************************
 * Запрос страницы списка тем группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей тем.
 * @throws Error сервера — разбирает вызывающий код (getTopics).
 * ************************************************************************
 */
export async function getTopicsRequest(data: GroupTopicsGetData): Promise<GroupTopicsPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GroupTopicRecord[]>("[group]: get topics", data);

}
