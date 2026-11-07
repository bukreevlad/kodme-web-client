// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

/**
 * ***************************************************************************
 * ContactRecord - запись списка контактов (строка списка формы).
 *
 * Поля — только те, что реально читает код формы: строка списка, аватар,
 * подписи онлайна. Служебные ключи (__domElements__, __unsubscribeStore__)
 * живут здесь же, потому что их пишут и читают подписки стора.
 ***************************************************************************
 */
export interface ContactRecord extends StoreItem {

    /** Id пользователя (UUID, строка — контракт с собственным сервером). */
    id: string;

    /** Отображаемое имя. */
    display_name?: string;

    /** Документ аватара (JSON сервера: document_id + токен). */
    avatar?: AvatarImageDocument | null;

    /** Флаг онлайна собеседника. */
    is_online?: boolean;

    /** Момент последней активности (ISO-строка) — для «Был(а) …». */
    last_action_at?: string;

    /** Отображённые копии строки (одна запись может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от точечного события обновления записи. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * ***************************************************************************
 * Опции добавления записи в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до строки списка — оно объявлено здесь, в месте использования.
 ***************************************************************************
 */
export interface ContactStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: "prev" | "next" | undefined;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is ContactStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до записи контакта.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это запись контакта с id-строкой.
 ***************************************************************************
 */
export function isContactRecord(payload: unknown): payload is ContactRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
