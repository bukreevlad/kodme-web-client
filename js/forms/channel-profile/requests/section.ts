// Импортируем config
import { Socket } from "../../../config/socket.js";

// Импортируем config (константы)
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { ChannelSectionItemData } from "../types.js";

/**
 * Данные запроса секции профиля канала.
 */
export interface SectionRequestData {

    /** Id канала. */
    channel_id: string;

    /** Курсор (attachment_id крайней записи) — для direction-запросов. */
    cursor_id?: string | undefined;

    /** Направление: prev — старше курсора, next — новее. Без него — первая страница. */
    direction?: "prev" | "next" | undefined;

    /** Сколько записей просим (сервер может отдать меньше). */
    offset?: number;

}

/**
 * Ответ сервера: страница записей секции.
 */
export interface SectionPageResponse extends Answer<ChannelSectionItemData[]> {

    /** Есть ли записи в запрошенном направлении (сервер шлёт на первой странице). */
    has_more?: boolean;

}

/**
 * Функция запроса секции: отправляет запрос и НЕ разбирает ошибки —
 * их показывает вызывающий код (functions/load_section.ts через toastError).
 */
export type SectionRequestFn = (data?: SectionRequestData) => Promise<SectionPageResponse>;

/**
 * ***************************************************************************
 * Фабрика запросов секций профиля канала.
 *
 * Зачем фабрика: шесть файлов requests/get_*.js отличались ровно одним —
 * именем события в emitWithAck. Ошибку наружу не пробрасываем: по правилам
 * проекта requests/ только отправляет запрос, а разбор ошибки делает
 * вызывающий код (functions/load_section.ts через toastError).
 * @param event - Событие сокета, например "[channel-profile]: get photos".
 * @returns Функция запроса: data => Promise<response>.
 * ***************************************************************************
 */
export function createSectionRequest(event: string): SectionRequestFn {

    return async function (data?: SectionRequestData): Promise<SectionPageResponse> {

        return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
            .emitWithAck(event, data);

    };

}
