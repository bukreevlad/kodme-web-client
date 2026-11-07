// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы
import { isRecord } from "../main/types.js";

/**
 * Папка в списке менеджера папок. Полей объявлено ровно столько, сколько
 * читает и пишет форма: серверная строка шире (приходят и другие поля,
 * они сохраняются в записи через индексную сигнатуру StoreItem).
 */
export interface MainFoldersManagerFolder extends StoreItem {

    /** Id папки (UUID v7). */
    id: string;

    /** Название папки. */
    name: string;

    /** Папка выбрана в вызвавшей форме (режим выбора). */
    is_selected?: boolean;

    /** Число чатов в папке (обогащение из IndexedDB). */
    chats_count?: number;

    /** Сумма непрочитанных сообщений в папке (обогащение из IndexedDB). */
    unread_count?: number;

    /** Отрисованные копии строки (каждая копия добавляет свой DOM). */
    __domElements__?: HTMLElement[];

    /** Отписка компонента строки от точечного события обновления. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * Данные папки, которые нужны вызывающему callback выбора: вызвавшая
 * форма читает только id и признак выбранности — остальные поля строки
 * её не касаются. Такой «срез» позволяет передавать callback-функции с
 * локальными интерфейсами без знания о полной записи папки.
 */
export interface MainFoldersManagerChoice {

    /** Id папки. */
    id: string;

    /** Папка выбрана в вызвавшей форме (режим выбора). */
    is_selected?: boolean;

}

/**
 * Опции добавления папки в стор: стор прокидывает options события
 * `item::added` как есть — direction читает вставка строки в список.
 */
export interface MainFoldersAddOptions extends StoreAddOptions {

    /** Направление вставки: "prev" — в начало списка, иначе — в конец. */
    direction?: "prev" | "next" | undefined;

}

/**
 * Нагрузка — запись папки: сверяем идентификатор (единственное обязательное
 * поле типа).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на запись папки.
 */
export function isMainFoldersManagerFolder(value: unknown): value is MainFoldersManagerFolder {
    return isRecord(value) && typeof value.id === "string";
}

/**
 * Опции добавления содержат направление вставки (в базовом типе опций поле
 * direction не объявлено).
 * @param options - Опции события item::added.
 * @returns true, если в опциях есть направление.
 */
export function hasDirection(options: StoreAddOptions | undefined): options is MainFoldersAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}
