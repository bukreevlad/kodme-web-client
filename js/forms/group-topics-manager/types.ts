// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы
import { isRecord } from "../main/types.js";

/**
 * Строка темы группы в списке менеджера. Полей объявлено ровно столько,
 * сколько читает и пишет компонент строки: серверная строка шире.
 */
export interface GroupTopicRecord extends StoreItem {

    /** Id темы (канала). */
    id: string;

    /** Отображаемое название темы. */
    display_name?: string;

    /** Имя автора темы. */
    author_name?: string;

    /** Отрисованные копии строки (каждая копия добавляет свой DOM). */
    __domElements__?: HTMLElement[];

    /** Отписка компонента строки от точечного события обновления. */
    __unsubscribeStore__?: () => void;

}

/**
 * Опции добавления темы в стор: стор прокидывает options события
 * `item::added` как есть — direction читает вставка строки в список.
 */
export interface GroupTopicAddOptions extends StoreAddOptions {

    /** Направление вставки: "prev" — в начало списка, иначе — в конец. */
    direction?: "prev" | "next" | undefined;

}

/**
 * Нагрузка — запись темы: сверяем идентификатор (единственное обязательное
 * поле типа).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на запись темы.
 */
export function isGroupTopicRecord(value: unknown): value is GroupTopicRecord {
    return isRecord(value) && typeof value.id === "string";
}

/**
 * Опции добавления содержат направление вставки (в базовом типе опций поле
 * direction не объявлено).
 * @param options - Опции события item::added.
 * @returns true, если в опциях есть направление.
 */
export function hasDirection(options: StoreAddOptions | undefined): options is GroupTopicAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}
