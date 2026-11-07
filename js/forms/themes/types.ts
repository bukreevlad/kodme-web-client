// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Направление пагинации списка тем оформления.
 */
export type ThemePaginationDirection = "prev" | "next";

/**
 * ***************************************************************************
 * ThemeListItem - тема в хранилище списка формы тем.
 *
 * Поля — только те, что реально читает форма: строка списка (название,
 * автор) и владелец темы (кнопка «Редактировать»). Служебные ключи
 * (__domElements__, __unsubscribeStore__) живут здесь же: их пишут
 * компонент строки и подписки стора.
 ***************************************************************************
 */
export interface ThemeListItem extends StoreItem {

    /** Id темы (UUID v7). */
    id: string;

    /** Название темы. */
    name: string;

    /** CSS-стили темы. */
    style: string;

    /** Id автора темы. */
    created_user_id: string;

    /** Имя автора (имя + фамилия, склеенные сервером; null без профиля). */
    author_name: string | null;

    /** Отображённые копии элемента (тема может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от события обновления элемента в сторе (снимает компонент). */
    __unsubscribeStore__?: () => void;

}

/**
 * Опции добавления элемента темы в стор: стор прокидывает options события
 * `item::added` как есть — direction читает вставка строки в список
 * (см. events/store/item_added.ts).
 */
export interface ThemeAddOptions extends StoreAddOptions {

    /** Направление вставки: "prev" — в начало списка, иначе — в конец. */
    direction?: ThemePaginationDirection | undefined;

}

/**
 * ***************************************************************************
 * Ответ сервера "[theme]: get themes": страница списка тем плюс признак
 * продолжения в запрошенном направлении (has_more добавлен поверх Answer).
 ***************************************************************************
 */
export interface ThemePage extends Answer<ThemeListItem[]> {

    /** Есть ли записи в запрошенном направлении. */
    has_more?: boolean;

}

/**
 * ***************************************************************************
 * Guard: похож ли payload события стора на элемент темы.
 * @param payload - Полезная нагрузка события стора.
 * @returns Да, если это элемент с UUID-идентификатором.
 ***************************************************************************
 */
export function isThemeItem(payload: unknown): payload is ThemeListItem {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
