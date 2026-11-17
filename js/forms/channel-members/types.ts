// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Направление пагинации списка участников.
 */
export type MemberPaginationDirection = "prev" | "next";

/**
 * ***************************************************************************
 * MemberRecord - участник в хранилище формы участников.
 *
 * Поля — только те, что реально читает форма: строка списка (имя, ссылка,
 * аватар) и модерация (контекст-меню).
 * ***************************************************************************
 */
export interface MemberRecord extends StoreItem {

    /** Id участника (UUID v7) — равен user_id: им оперирует пагинация. */
    id: string;

    /** Id пользователя. */
    user_id: string;

    /** Отображённое имя. */
    display_name?: string;

    /** Ссылка профиля (@username). */
    link?: string | null;

    /** Аватар профиля. */
    avatar?: AvatarImageDocument | null;

    /** Участник — бот (профиль открывается формой бота). */
    is_bot?: boolean;

    /** Участник — модератор канала. */
    is_moderator?: boolean;

    /** Участник подписан на сущность. */
    is_subscribed?: boolean;

    /** Когда участник подписался (ISO). */
    subscribed_at?: string | null;

    /** Участник заблокирован в канале. */
    is_banned?: boolean;

    /** Когда участник заблокирован (ISO). */
    banned_at?: string | null;

}

/**
 * Опции добавления участника в стор: стор прокидывает options события
 * `item::added` как есть — direction читает вставка строки в список
 * (см. events/store/item_added.ts).
 */
export interface MemberAddOptions extends StoreAddOptions {

    /** Направление вставки: "prev" — в начало списка, иначе — в конец. */
    direction?: MemberPaginationDirection | undefined;

}

/**
 * ***************************************************************************
 * Ответ сервера "[channel-member]: get members": страница списка
 * участников плюс признак продолжения (has_more добавлен поверх Answer).
 * ***************************************************************************
 */
export interface MemberPage extends Answer<MemberRecord[]> {

    /** Есть ли записи в запрошенном направлении. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Guard: похож ли payload события стора на участника.
 * @param payload - Полезная нагрузка события стора.
 * @returns Да, если это запись с UUID-идентификатором.
 * ***************************************************************************
 */
export function isMemberRecord(payload: unknown): payload is MemberRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
