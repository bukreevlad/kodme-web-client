// Импортируем utils
import type { StoreItem } from "../../utils/store.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Стикер в превью пака: документ + токен на чтение файла.
 */
export interface StickerPreviewItem {

    /** Id стикера (строка-связь вложения, UUID v7). */
    sticker_id: string;

    /** Id документа файла (UUID v7). */
    document_id: string;

    /** Токен на чтение файла (query `?token=…` ссылки хранилища). */
    file_token: string | null;

}

/**
 * ***************************************************************************
 * StickerPakItem - пак в хранилище списка формы паков стикеров.
 *
 * Поля — только те, что реально читает форма: строка списка (название,
 * автор, превью 2×2) и флаги видимости (`is_author` / `is_member`) для
 * контекстного меню. Служебные ключи (`__domElements__`,
 * `__unsubscribeStore__`) живут здесь же: их пишут компонент строки
 * и подписки стора.
 ***************************************************************************
 */
export interface StickerPakItem extends StoreItem {

    /** Id пака (UUID v7). */
    id: string;

    /** Название пака. */
    name: string;

    /** Описание пака (null — не заполнено). */
    about: string | null;

    /** Публичный пак (виден всем) или приватный (только автору). */
    is_public: boolean;

    /** Id автора пака. */
    created_user_id: string;

    /** Дата создания (ISO). */
    created_at: string;

    /** Имя автора (имя + фамилия, склеенные сервером; null без профиля). */
    author_name: string | null;

    /** Текущий пользователь — автор пака. */
    is_author: boolean;

    /** Текущий пользователь подписан на пак (добавил к себе). */
    is_member: boolean;

    /** Количество стикеров пака. */
    stickers_count: number;

    /** Превью: первые 4 стикера пака (сетка 2×2). */
    preview: StickerPreviewItem[];

    /** Отображённые копии элемента (пак может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от события обновления элемента в сторе (снимает компонент). */
    __unsubscribeStore__?: () => void;

}

/**
 * ***************************************************************************
 * Ответ сервера "[sticker]: get paks": страница списка паков плюс признак
 * продолжения (has_more добавлен поверх Answer).
 ***************************************************************************
 */
export interface StickerPakPage extends Answer<StickerPakItem[]> {

    /** Есть ли продолжение после текущей страницы. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Guard: похож ли payload события стора на элемент пака.
 * @param payload - Полезная нагрузка события стора.
 * @returns Да, если это элемент с UUID-идентификатором.
 ***************************************************************************
 */
export function isStickerPakItem(payload: unknown): payload is StickerPakItem {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
