// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";
import type { Thumbnail } from "../../utils/helpers/get_thumbnail_size_query.js";

/**
 * Направление загрузки страницы списка трансляций (keyset-пагинация).
 */
export type BroadcastDirection = "prev" | "next";

/**
 * Обложка трансляции: документ storage с серверными миниатюрами.
 */
export interface CastThumbnail {

    /** Id документа в storage (строится URL превью). */
    id: string;

    /** Токен доступа к файлу. */
    token?: string;

    /** Метаданные файла (из них берутся миниатюры; null — метаданных нет). */
    metadata?: {

        /** Список серверных миниатюр. */
        thumbnails?: Thumbnail[];

    } | null;

}

/**
 * ***************************************************************************
 * BroadcastCast - трансляция в хранилище формы (карточка списка).
 *
 * Поля — только те, что реально читает код формы: карточка списка и
 * сокет-обновление. Служебные ключи (__domElements__, __unsubscribeStore__)
 * живут здесь же, потому что их пишут и читают подписки стора.
 ***************************************************************************
 */
export interface BroadcastCast extends StoreItem {

    /** Id трансляции (UUID сервера). */
    id: string;

    /** Название трансляции. */
    name: string;

    /** Отображаемое имя автора (имя либо короткая ссылка бота). */
    created_display_name?: string | null;

    /** Флаг «идёт эфир» (бейдж LIVE). */
    is_live?: boolean;

    /** Документ обложки трансляции. */
    thumbnail?: CastThumbnail | null;

    /** Отображённые копии карточки (одна запись может попасть в список дважды). */
    __domElements__?: HTMLElement[];

    /** Отписка от точечного события обновления записи. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * ***************************************************************************
 * Опции добавления трансляции в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до карточки списка — оно объявлено здесь, в месте использования.
 ***************************************************************************
 */
export interface BroadcastStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: BroadcastDirection | undefined;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is BroadcastStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до трансляции.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это трансляция с id-строкой.
 ***************************************************************************
 */
export function isBroadcastCast(payload: unknown): payload is BroadcastCast {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
