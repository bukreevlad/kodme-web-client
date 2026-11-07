// Импортируем utils
import type { StoreItem, StoreAddOptions } from "../../utils/store.js";
import type { AttachmentsRaw } from "../../utils/messages/attachments.js";

// Импортируем components (только типы)
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Тип сущности-владельца комментариев. Поддерживаются только посты
 * сообществ (канал type = 3).
 */
export type EntityType = "message";

/**
 * Направление подгрузки страницы комментариев (keyset-пагинация).
 */
export type CommentsDirection = "prev" | "next";

/**
 * Автор реакции на комментарий (рендерится аватаркой в блоке реакций).
 */
export interface CommentReactionAvatar {

    /** Id автора реакции. */
    user_id?: string;

    /** Отображаемое имя автора реакции. */
    display_name?: string;

    /** Аватар автора реакции. */
    avatar?: AvatarImageDocument | null;

}

/**
 * Emoji-реакция на комментарий (одна кнопка в блоке реакций).
 */
export interface CommentReaction {

    /** Emoji-реакция. */
    reaction?: string;

    /** Число поставивших. */
    count?: number;

    /** Поставил ли её текущий пользователь. */
    is_selected?: boolean;

    /** Авторы реакций (рендерятся аватарками). */
    avatars?: CommentReactionAvatar[];

}

/**
 * ***************************************************************************
 * CommentRecord - комментарий в Store формы.
 *
 * Поля — только те, что реально читает код формы (рендер строки, реакции,
 * ответы). Остальные ключи свободно дописываются через индексную сигнатуру
 * `StoreItem`.
 * ***************************************************************************
 */
export interface CommentRecord extends StoreItem {

    /** Id комментария (UUID v7). */
    id: string;

    /** Id поста-владельца. */
    entity_id?: string;

    /** Тип сущности-владельца ("message"). */
    entity_type?: string;

    /** Id автора комментария. */
    created_user_id?: string | undefined;

    /** Отображаемое имя автора. */
    display_name?: string;

    /** Аватар автора. */
    avatar?: AvatarImageDocument | null;

    /** Текст комментария (HTML-экранирован сервером). */
    text?: string | null;

    /** Время создания (ISO). */
    created_at?: string;

    /** Время редактирования (ISO) или null. */
    edited_at?: string | null;

    /** Id канала поста. */
    channel_id?: string;

    /** Тип канала (3 — сообщество). */
    channel_type?: number;

    /** Текущий пользователь — модератор канала. */
    is_moderator?: boolean;

    /** Комментарий, на который отвечаем (null — корневой). */
    reply_to_comment_id?: string | null;

    /** Данные комментария-предка для отрисовки цитаты ответа. */
    reply_to_comment?: CommentRecord | null;

    /** Реакции (заполняет сервер). */
    reactions?: CommentReaction[];

    /** Вложения комментария (мапа или массив — как приходит с сервера). */
    attachments?: AttachmentsRaw;

    /** Флаг «не отправлено» — ошибка отправки (локальное состояние). */
    is_error_sending?: boolean;

    /** Флаг «отправляется» — ожидание ack сервера (локальное состояние). */
    is_sending?: boolean;

    /** Комментарий удалён глобально (сервер присылает без текста и вложений). */
    is_deleted?: boolean;

}

/**
 * Настройки формы комментариев.
 */
export interface CommentsFormOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы комментариев.
 */
export interface CommentsFormData {

    /** Id поста (сообщения), под которым открыта ветка. */
    postId: string;

    /** Id канала поста. */
    channelId: string;

    /** Настройки формы. */
    options?: CommentsFormOptions;

}

/**
 * Ожидание ack исходящего комментария (освобождается при закрытии формы).
 */
export interface PendingAck {

    /** Разрешить ожидание ack (снимает зависший промис пуша). */
    resolve?: () => void;

}

/**
 * Опции добавления комментария в Store.
 */
export interface CommentStoreAddOptions extends StoreAddOptions {

    /** Направление, в которое добавляется элемент ("prev"/"next"). */
    direction?: CommentsDirection;

}

/**
 * Типguard: запись похожа на комментарий (есть id).
 * @param item - Элемент Store.
 * @returns true, если запись — комментарий.
 */
export function isCommentRecord(item: unknown): item is CommentRecord {
    return Boolean(item && typeof item === "object" && "id" in item);
}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 * ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is CommentStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}
