// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StoreId } from "../../../utils/store.js";
import type { ContactRecord } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса страницы списка контактов.
 ***************************************************************************
 */
export interface GetContactsData {

    /** Id записи старта (крайний id стора). */
    cursor_id?: StoreId | null | undefined;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: "prev" | "next" | undefined;

    /** Количество записей. */
    offset?: number;

}

/**
 * ***************************************************************************
 * Ответ сервера: страница списка + признак продолжения в запрошенном
 * направлении (сервер добавляет `has_more` к общему ответу API).
 ***************************************************************************
 */
export interface ContactPage extends Answer<ContactRecord[]> {

    /** Есть ли продолжение в сторону `direction`. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Запрос страницы списка контактов.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_contacts.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера страницей контактов.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getContactsRequest(data: GetContactsData): Promise<ContactPage> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ContactRecord[]>("[contact]: get contacts", data);

}
