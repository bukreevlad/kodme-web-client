// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { ThemeListItem, ThemePage, ThemePaginationDirection } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка тем оформления.
 ***************************************************************************
 */
export interface GetThemesData {

    /** Направление загрузки: отсутствует — первая страница. */
    direction?: ThemePaginationDirection | undefined;

    /** Id записи старта (UUID крайнего элемента запрошенного направления). */
    cursor_id?: string | undefined;

    /** Количество записей. */
    offset: number;

}

/**
 * ***************************************************************************
 * Запрос страницы списка тем оформления.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_themes.ts).
 * @param data - Данные запроса.
 * @returns Страница списка тем с признаком has_more.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getThemesRequest(data: GetThemesData): Promise<ThemePage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ThemeListItem[]>("[theme]: get themes", data);

}
