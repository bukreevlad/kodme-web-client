// Импортируем типы
import type { StoreAddOptions } from "../../utils/store.js";
import type { ChannelRecord } from "../main/types.js";
import type { ForwardMessages } from "./index.js";

/**
 * ***************************************************************************
 * ForwardChannelRecord - канал в списке пересылки (строка из IndexedDB
 * главной формы).
 *
 * Поля created_user_id/is_posting/is_public приходят от сервера целиком
 * (спред ответа "[channel]: get user conversations" при сохранении в
 * IndexedDB) и нужны форме для предфильтра «куда разрешено пересылать»:
 * они объявлены здесь, потому что базовый ChannelRecord их не читает.
 * ***************************************************************************
 */
export interface ForwardChannelRecord extends ChannelRecord {

    /** Id создателя канала. */
    created_user_id?: string;

    /** Могут ли писать все участники сущности. */
    is_posting?: boolean;

    /** Публичная ли сущность. */
    is_public?: boolean;

}

/**
 * Опции добавления канала в стор: направление вставки (направление
 * пробрасывается стором подписчикам item::added; список пересылки его
 * не читает — вставляет строки в конец).
 */
export interface ForwardChannelAddOptions extends StoreAddOptions {

    /** Направление вставки страницы. */
    direction?: "prev" | "next";

}

/**
 * Строка списка пересылки: форма, данные канала и её DOM-элемент.
 *
 * Состояние выделения хранится не в объекте, а в классе элемента
 * ("selected"): одна строка — один элемент, класс переживает
 * перерисовку данных и доступен там, где лежит и сам элемент.
 */
export interface ChannelItem {

    /** Экземпляр формы пересылки. */
    form: ForwardMessages;

    /** Данные канала (обновляются подпиской item::updated::). */
    data: ForwardChannelRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

}

/**
 * ***************************************************************************
 * Сужение payload'а стора до канала списка.
 *
 * Данные приходят из хранилища формы, но тип события стора - unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это канал с id.
 * ***************************************************************************
 */
export function isForwardChannel(payload: unknown): payload is ForwardChannelRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
