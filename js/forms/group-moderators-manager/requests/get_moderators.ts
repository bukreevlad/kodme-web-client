// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { GroupModeratorRecord } from "../types.js";

/**
 * Данные запроса страницы списка модераторов группы.
 */
export interface GroupModeratorsGetData {

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
 * Ответ сервера: страница списка модераторов плюс признак продолжения в
 * запрошенном направлении (has_more добавлен поверх Answer).
 */
export interface GroupModeratorsPage extends Answer<GroupModeratorRecord[]> {

    /** Есть ли записи в запрошенном направлении. */
    has_more?: boolean;

}

/**
 * ************************************************************************
 * Запрос страницы списка модераторов группы.
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей модераторов.
 * @throws Error сервера — разбирает вызывающий код (getModerators).
 * ************************************************************************
 */
export async function getModeratorsRequest(data: GroupModeratorsGetData): Promise<GroupModeratorsPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GroupModeratorRecord[]>("[group]: get moderators", data);

}
