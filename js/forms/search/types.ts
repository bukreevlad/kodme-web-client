// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

/**
 * ***************************************************************************
 * SearchRecord - запись результата поиска (строка списка любой категории).
 *
 * Поля — только те, что реально читает код формы: строки списков, аватары,
 * подписи. Состав различается по категориям (у ботов — `link` вместо
 * `display_name`, у людей — `is_online`/`last_action_at`, у сообществ —
 * `total_members`), поэтому поля опциональны. Служебный ключ `__domElements__`
 * живёт здесь же, потому что его пишут и читают подписки стора.
 ***************************************************************************
 */
export interface SearchRecord extends StoreItem {

    /** Id записи (UUID строка — контракт с собственным сервером). */
    id: string;

    /** Отображаемое имя (категории channels / groups / users). */
    display_name?: string;

    /** Публичная ссылка бота (категория bots). */
    link?: string;

    /** Документ аватара (JSON сервера: document_id + токен). */
    avatar?: AvatarImageDocument | null;

    /** Количество участников (категории channels / groups). */
    total_members?: number;

    /** Флаг онлайна (категории users / bots). */
    is_online?: boolean;

    /** Момент последней активности (ISO-строка) — для «Был(а) …» (users). */
    last_action_at?: string;

    /** Отображённые копии строки (одна запись может попасть в список дважды). */
    __domElements__?: HTMLElement[];

}

/**
 * ***************************************************************************
 * SectionPagination - состояние пагинации одной категории поиска.
 *
 * Ключи больше не выводятся строкой из `id` (легаси-вид `${id}FirstLoaded`):
 * состояние лежит в `Search.pagination[id]` типизированной записью. Поля
 * `undefined` означают «ещё не известно» — для проверок это эквиваленто
 * «не загружено / данных больше нет неизвестно».
 ***************************************************************************
 */
export interface SectionPagination {

    /** Первая страница категории применена. */
    firstLoaded?: boolean;

    /** Идёт догрузка пачки старых записей (prev). */
    loadingPrev?: boolean;

    /** Идёт догрузка пачки новых записей (next). */
    loadingNext?: boolean;

    /** Есть ли продолжение в сторону prev (false — не стучимся к серверу). */
    hasMorePrev?: boolean;

    /** Есть ли продолжение в сторону next (false — не стучимся к серверу). */
    hasMoreNext?: boolean;

}

/**
 * Служебное состояние вкладки поиска. Тексты — из locales/ru.json
 * → forms.search.states.
 */
export type SectionState = "loading" | "empty" | "error";

/**
 * ***************************************************************************
 * Опции добавления записи в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до строки списка — оно объявлено здесь, в месте использования.
 ***************************************************************************
 */
export interface SearchStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: "prev" | "next";

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is SearchStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до записи результата поиска.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это запись поиска с id-строкой.
 ***************************************************************************
 */
export function isSearchRecord(payload: unknown): payload is SearchRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
