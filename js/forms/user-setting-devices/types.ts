// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";
import type { IsoTimestamp } from "../../types/domain.js";

/**
 * Направление загрузки страницы списка сессий (keyset-пагинация).
 */
export type DeviceDirection = "prev" | "next";

/**
 * ***************************************************************************
 * SessionListItem - сессия (устройство) в хранилище формы (строка списка).
 *
 * Поля — только те, что реально читает код формы: строка списка и подписки
 * стора. Служебный ключ (__domElements__) живёт здесь же, потому что его
 * пишут и читают подписки стора.
 ***************************************************************************
 */
export interface SessionListItem extends StoreItem {

    /** Id сессии (UUID сервера). */
    id: string;

    /** Платформа устройства (фолбэк названия, если user_agent пуст — например, у сессий, созданных до сохранения user-agent). */
    platform?: string | null;

    /** User-agent устройства (парсится в название платформы/браузера). */
    user_agent: string;

    /** Время последней активности сессии. */
    last_action_at: IsoTimestamp | null;

    /** Отображённые копии строки (одна сессия может попасть в список дважды). */
    __domElements__?: HTMLElement[];

}

/**
 * ***************************************************************************
 * SessionStoreAddOptions - опции добавления сессии в стор, дополненные
 * направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см.
 * Store.add → emit), поэтому направление ["prev" | "next"] реально доходит
 * до строки списка — оно объявлено здесь, в месте использования.
 ***************************************************************************
 */
export interface SessionStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: DeviceDirection | undefined;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 * ***************************************************************************
 */
export function hasDeviceDirection(options: StoreAddOptions | undefined): options is SessionStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до сессии.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это сессия с id-строкой.
 * ***************************************************************************
 */
export function isSessionListItem(payload: unknown): payload is SessionListItem {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
