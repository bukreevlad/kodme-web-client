// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type {
    CloudAccessLevel,
    CloudFileRow,
    CloudFolderRow,
    CloudPaginationDirection
} from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса содержимого папки.
 ***************************************************************************
 */
export interface GetFolderData {

    /** Id папки (корень облака, если не передан). */
    folder_id?: string | null;

    /** Id ссылки (для общего доступа). */
    link_id?: string | null;

    /** Значение ссылки (для общего доступа). */
    link?: string | null | undefined;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: CloudPaginationDirection | null;

    /** Id записи старта. */
    cursor_id?: string | null;

    /** Количество записей. */
    offset?: number;

}

/**
 * Содержимое папки облака: папки целиком, файлы страницами.
 */
export interface CloudFolderContent {

    /** Папки папки (отдаются всегда первыми и целиком). */
    folders: CloudFolderRow[];

    /** Файлы папки (порция по offset). */
    files: CloudFileRow[];

    /** Признак «файлы ещё есть». */
    has_more: boolean;

    /** Уровень доступа к содержимому. */
    access_level: CloudAccessLevel;

    /** Владелец содержимого. */
    owner_user_id: string | null;

}

/**
 * ***************************************************************************
 * Получение содержимого папки своего облака.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_folder.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера содержимым папки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getFolderRequest(data: GetFolderData): Promise<Answer<CloudFolderContent>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<CloudFolderContent>("[cloud]: get folder", data);

}
