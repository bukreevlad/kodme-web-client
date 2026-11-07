// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MainFoldersManagerFolder } from "../types.js";

/**
 * Данные запроса страницы списка папок.
 */
export interface MainFoldersGetData {

    /** Направление загрузки ["prev" | "next"] — отсутствует: первая страница. */
    direction?: "prev" | "next" | undefined;

    /** Id крайней папки, с которой начинать выборку. */
    cursor_id?: string | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * Ответ сервера: страница списка папок плюс признак продолжения в запрошенном
 * направлении (has_more добавлен поверх Answer).
 */
export interface MainFoldersPage extends Answer<MainFoldersManagerFolder[]> {

    /** Есть ли папки в запрошенном направлении. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка папок пользователя.
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей папок.
 * @throws Error сервера — разбирает вызывающий код (getFolders).
 * ***************************************************************************
 */
export async function getFoldersRequest(data: MainFoldersGetData): Promise<MainFoldersPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MainFoldersManagerFolder[]>("[main]: get folders", data);

}
