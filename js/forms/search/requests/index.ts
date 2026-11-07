// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем config формы
import type { SectionId } from "../config/sections.js";
import { SECTIONS } from "../config/sections.js";

// Импортируем utils
import type { StoreId } from "../../../utils/store.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { SearchRecord } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы результатов поиска.
 ***************************************************************************
 */
export interface SectionRequestData {

    /** Поисковая строка. */
    search?: string;

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | undefined;

    /** Направление ["prev" | "next"]. Без направления — первая страница. */
    direction?: "prev" | "next" | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница результатов + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 ***************************************************************************
 */
export interface SearchPage extends Answer<SearchRecord[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы результатов поиска.
 *
 * Замена четырёх файлов get_channels/get_groups/get_users/get_bots, которые
 * различались только строкой события. Каждый из них дополнительно оборачивал
 * запрос в `try { … } catch (error) { throw error }` — обёртка не делала
 * ничего, а по правилам репозитория модуль запроса только отправляет запрос
 * и пробрасывает ошибку наружу: разбирает её вызывающий код (см. E2).
 *
 * Событие берётся из описания категории, а не из карты в этом файле: иначе
 * появился бы второй список категорий, который можно забыть обновить.
 *
 * Таймаут вынесен в SOCKET_REQUEST_TIMEOUT: раньше `timeout(5000)` был
 * зашит в каждом из четырёх файлов.
 *
 * @param id - Категория ["channels" | "groups" | "users" | "bots"].
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей результатов.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function sectionRequest(id: SectionId, data: SectionRequestData): Promise<SearchPage> {

    const config = SECTIONS[id];
    if (!config?.event) throw new Error("[search]: неизвестная категория поиска");

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SearchRecord[]>(config.event, data);

}
