// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Стикер внутри пака: документ + токен на чтение файла.
 */
export interface StickerItem {

    /** Id стикера (строка-связь вложения, UUID v7). */
    sticker_id: string;

    /** Id документа файла (UUID v7). */
    document_id: string;

    /** Токен на чтение файла (query `?token=…` ссылки хранилища). */
    file_token: string | null;

}

/**
 * Пак стикеров с полным списком стикеров — данные формы содержимого пака.
 */
export interface StickerPakData {

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

    /** Все стикеры пака (порядок — по хронологии добавления). */
    stickers: StickerItem[];

}

/**
 * Ответ сервера "[sticker]: get pak": пак + полный список стикеров.
 */
export type StickerPakAnswer = Answer<StickerPakData>;
