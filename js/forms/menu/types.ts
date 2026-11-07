// Импортируем типы
import type { AvatarImageDocument } from "../../components/avatars.js";
import type { StoredSession } from "../../utils/local_storage.js";

/**
 * ***************************************************************************
 * SessionProfile - профиль пользователя внутри сессии: поля, которые читает
 * меню (шапка профиля, аватар, переход в «Мой профиль»).
 *
 * Поле `user` хранится как `unknown` (внешний данные на границе localStorage),
 * поэтому форма читает его этим сужением — см. invariant в местах чтения.
 * ***************************************************************************
 */
export interface SessionProfile {

    /** Id пользователя (нет у сессии до первой проверки). */
    id?: string;

    /** Отображаемое имя. */
    display_name?: string;

    /** Публичная ссылка профиля. */
    link?: string;

    /** Описание профиля. */
    bio?: string;

    /** Документ аватара (JSON сервера: document_id + токен). */
    avatar?: AvatarImageDocument | null;

}

/**
 * ***************************************************************************
 * MenuSessionItem - элемент стора меню: сессия из localStorage плюс ссылки
 * на DOM-копии строк списка (для удаления строк при выгрузке из стора).
 *
 * `Pick<StoredSession, …>` — не `extends`: mapped-тип получает индексную
 * сигнатуру и удовлетворяет контракту `StoreItem` хранилища.
 * ***************************************************************************
 */
export type MenuSessionItem = Pick<StoredSession, keyof StoredSession> & {

    /** Отображённые копии строки (одна сессия может попасть в список дважды). */
    __domElements__?: HTMLElement[];

};

/**
 * Guard: похож ли payload события Store на элемент меню.
 * @param value - Payload события хранилища.
 * @returns Да, если это элемент с идентификатором.
 */
export function isMenuSessionItem(value: unknown): value is MenuSessionItem {
    if (!value || typeof value !== "object") return false;

    // Сужение unknown через in: элемент хранилища обязан содержать id
    return "id" in value;
}
