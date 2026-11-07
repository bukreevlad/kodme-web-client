// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

/**
 * Направление загрузки страницы списка приглашений (keyset-пагинация).
 */
export type MeetInviteDirection = "prev" | "next";

/**
 * ***************************************************************************
 * MeetInviteRecord - приглашение в хранилище формы (строка списка).
 *
 * Поля — только те, что реально читает код формы (название и ссылка строки).
 * Служебные ключи (__domElements__, __unsubscribeStore__) живут здесь же,
 * потому что их пишут и читают подписки стора.
 * ***************************************************************************
 */
export interface MeetInviteRecord extends StoreItem {

    /** Id приглашения (UUIDv7 сервера). */
    id: string;

    /** Название приглашения. */
    name: string;

    /** Значение ссылки-приглашения. */
    link: string;

    /** Отображённые копии строки (одно приглашение может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от точечного события обновления записи. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * ***************************************************************************
 * Опции добавления приглашения в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до строки списка — оно объявлено здесь, в месте использования.
 * ***************************************************************************
 */
export interface MeetInviteStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: MeetInviteDirection | undefined;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 * ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is MeetInviteStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до приглашения.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это приглашение с id.
 * ***************************************************************************
 */
export function isMeetInvite(payload: unknown): payload is MeetInviteRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
