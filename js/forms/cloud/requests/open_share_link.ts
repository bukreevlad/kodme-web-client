// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type {
    CloudAccessLevel,
    CloudFilePayload,
    CloudFileRow,
    CloudFolderRow,
    CloudPaginationDirection,
    CloudShareLinkRow,
    CloudSharedItem,
    CloudSharedOwner
} from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса открытия ссылки общего доступа.
 ***************************************************************************
 */
export interface OpenShareLinkData {

    /** Значение ссылки (токен). */
    link?: string | null | undefined;

    /** Папка внутри общего поддерева (навигация). */
    folder_id?: string | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: CloudPaginationDirection | null;

    /** Id записи старта. */
    cursor_id?: string | null;

    /** Количество записей. */
    offset?: number;

}

/**
 * Данные ссылки общего доступа: элемент, владелец и (для папки) содержимое.
 */
export interface OpenShareLinkResult {

    /** Ссылка. */
    link: CloudShareLinkRow;

    /** Элемент, на который ведёт ссылка. */
    item: CloudSharedItem;

    /** Владелец ссылки. */
    owner: CloudSharedOwner;

    /** Данные файла (только для ссылки на файл). */
    file?: CloudFilePayload | null;

    /** Папки общего поддерева (для ссылки на папку). */
    folders?: CloudFolderRow[];

    /** Файлы общего поддерева (для ссылки на папку). */
    files?: CloudFileRow[];

    /** Признак «файлы ещё есть» (для ссылки на папку). */
    has_more?: boolean;

    /** Уровень доступа текущего пользователя по ссылке. */
    access_level?: CloudAccessLevel;

    /** Владелец содержимого (для ссылки на папку). */
    owner_user_id?: string | null;

}

/**
 * ***************************************************************************
 * Открытие ссылки общего доступа по токену (папка — с содержимым).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/open_share_link.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера данными ссылки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function openShareLinkRequest(data: OpenShareLinkData): Promise<Answer<OpenShareLinkResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<OpenShareLinkResult>("[cloud]: open share link", data);

}
