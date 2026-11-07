// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";
import type { Thumbnail } from "../../utils/helpers/get_thumbnail_size_query.js";

/**
 * Направление загрузки страницы списка конференций (keyset-пагинация).
 */
export type MeetDirection = "prev" | "next";

/**
 * Обложка конференции: документ storage с серверными миниатюрами.
 */
export interface MeetThumbnail {

    /** Id документа в storage (строится URL превью). */
    id: string;

    /** Токен доступа к файлу. */
    token?: string;

    /** Метаданные файла (из них берутся миниатюры). */
    metadata?: {

        /** Список серверных миниатюр. */
        thumbnails?: Thumbnail[];

    };

}

/**
 * ***************************************************************************
 * MeetRecord - конференция в хранилище формы (карточка списка) и в настройках.
 *
 * Один и тот же объект отдаёт сервер и для списка, и для формы настроек
 * (оба читают meta конференции), поэтому тип общий. Поля — только те, что
 * реально читает код формы. Служебные ключи (__domElements__,
 * __unsubscribeStore__) живут здесь же, потому что их пишут и читают
 * подписки стора.
 ***************************************************************************
 */
export interface MeetRecord extends StoreItem {

    /** Id конференции (UUID сервера). */
    id: string;

    /** Название конференции. */
    name: string;

    /** Описание (сервер хранит пустое описание как null). */
    about?: string | null;

    /** Публичная (находимая в поиске) конференция. */
    is_public?: boolean;

    /** Включён ли чат конференции. */
    is_chat?: boolean;

    /** Id канала-чата конференции. */
    chat_channel_id?: string;

    /** Отображаемое имя автора конференции. */
    created_display_name?: string | null;

    /** Документ обложки конференции. */
    thumbnail?: MeetThumbnail | null;

    /** Отображённые копии карточки (одна запись может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от точечного события обновления записи. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * ***************************************************************************
 * Опции добавления конференции в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до карточки списка — оно объявлено здесь, в месте использования.
 ***************************************************************************
 */
export interface MeetStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: MeetDirection | undefined;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is MeetStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до конференции.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это конференция с id-строкой.
 ***************************************************************************
 */
export function isMeetRecord(payload: unknown): payload is MeetRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
