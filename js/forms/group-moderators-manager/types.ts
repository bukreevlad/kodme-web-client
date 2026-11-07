// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы
import { isRecord } from "../main/types.js";
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Модератор группы в списке менеджера (и ответ "[group]: get moderator
 * settings" — форма объединяет данные участника и пользователя). Полей
 * объявлено ровно столько, сколько читает и пишет код.
 */
export interface GroupModeratorRecord extends StoreItem {

    /** Id (у строки списка это id пользователя — ключ стора). */
    id: string;

    /** Id пользователя-модератора. */
    user_id: string;

    /** Отображаемое имя. */
    display_name?: string;

    /** Ссылка профиля (@username). */
    link?: string | null;

    /** Описание профиля. */
    bio?: string | null;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

    /** Разрешено удалять сообщения. */
    can_deleted_message?: boolean;

    /** Разрешено чистить все сообщения пользователя. */
    can_clean_messages?: boolean;

    /** Разрешено блокировать участников. */
    can_restrict_members?: boolean;

    /** Отрисованные копии строки (каждая копия добавляет свой DOM). */
    __domElements__?: HTMLElement[];

    /** Отписка компонента строки от точечного события обновления. */
    __unsubscribeStore__?: () => void;

}

/**
 * Флаги доступа модератора: общие для добавления и сохранения настроек.
 */
export interface GroupModeratorFlags {

    /** Удалять сообщения. */
    can_deleted_message: boolean;

    /** Чистить все сообщения пользователя. */
    can_clean_messages: boolean;

    /** Блокировать участников. */
    can_restrict_members: boolean;

    /** Приглашать пользователей. */
    can_invite_users: boolean;

    /** Закреплять сообщения. */
    can_pin_messages: boolean;

}

/**
 * Опции добавления модератора в стор: стор прокидывает options события
 * `item::added` как есть — direction читает вставка строки в список.
 */
export interface GroupModeratorAddOptions extends StoreAddOptions {

    /** Направление вставки: "prev" — в начало списка, иначе — в конец. */
    direction?: "prev" | "next" | undefined;

}

/**
 * Нагрузка — запись модератора: сверяем идентификатор (единственное
 * обязательное поле типа).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на запись модератора.
 */
export function isGroupModeratorRecord(value: unknown): value is GroupModeratorRecord {
    return isRecord(value) && typeof value.id === "string";
}

/**
 * Опции добавления содержат направление вставки (в базовом типе опций поле
 * direction не объявлено).
 * @param options - Опции события item::added.
 * @returns true, если в опциях есть направление.
 */
export function hasDirection(options: StoreAddOptions | undefined): options is GroupModeratorAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}
