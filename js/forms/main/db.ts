// Импортируем сторонние пакеты
import type { Table } from "dexie";

// Импортируем utils
import { IndexedDB } from "../../utils/indexed_db.js";
import { cleanStoreData } from "../../utils/helpers/clean_store_data.js";
import type { StoreItem } from "../../utils/store.js";

// Импортируем типы
import type { ChannelFeedEvent, UserFeedEvent } from "../../types/domain.js";
import type { ChannelRecord, MessageRecord } from "./types.js";

/**
 * ***************************************************************************
 * DB - доступ к таблицам IndexedDB главной формы.
 *
 * Схему задаёт utils/indexed_db; здесь таблицы берутся через обобщённый
 * `table<T>()`, чтобы строки были типизированы.
 *
 * Здесь же живёт чистка служебных полей перед записью: чистка нужна
 * именно в момент сохранения записи, поэтому и живёт рядом с таблицами.
 * ***************************************************************************
 */

/** Запись пакета обновлений, отложенного до применения (восстановление после сбоя). */
export interface PendingUpdateRow {

    /** Id записи (UUID v7). */
    id: string;

    /** Пропущенные обновления (те же элементы, что вернул сервер). */
    data: ChannelFeedEvent[];

    /** Время записи пакета (мс). */
    timestamp: number;

}

/**
 * Доступ к таблице открытой базы.
 *
 * Без инициализированной БД читать нечего — отсутствие базы называется явно.
 * @param name - Имя таблицы в схеме.
 * @returns Таблица с типизированными строками.
 */
function requireTable<T>(name: string): Table<T, string> {

    const db = IndexedDB.db;
    if (!db) {
        throw new Error(`[app][IndexedDB]: База данных не инициализирована — таблица "${name}" недоступна.`);
    }

    return db.table<T, string>(name);

}

/**
 * Таблица каналов (строки сайдбара и тем).
 * @returns Таблица с типизированными строками каналов.
 */
export function channelsTable(): Table<ChannelRecord, string> {
    return requireTable<ChannelRecord>("channels");
}

/**
 * Таблица сообщений.
 * @returns Таблица с типизированными строками сообщений.
 */
export function messagesTable(): Table<MessageRecord, string> {
    return requireTable<MessageRecord>("messages");
}

/**
 * Таблица отложенных (исходящих, ждущих эха) сообщений.
 * @returns Таблица с типизированными строками сообщений.
 */
export function pendingMessagesTable(): Table<MessageRecord, string> {
    return requireTable<MessageRecord>("pending_messages");
}

/**
 * Таблица пакетов обновлений, записанных до применения.
 * @returns Таблица с типизированными строками пакетов.
 */
export function pendingUpdatesTable(): Table<PendingUpdateRow, string> {
    return requireTable<PendingUpdateRow>("pending_updates");
}

/**
 * Запись пакета событий личной ленты, отложенного до применения
 * (восстановление после сбоя). Зеркало PendingUpdateRow.
 */
export interface PendingUserUpdateRow {

    /** Id записи (UUID v7). */
    id: string;

    /** События личной ленты (те же элементы, что вернул сервер). */
    data: UserFeedEvent[];

    /** Время записи пакета (мс). */
    timestamp: number;

}

/**
 * Таблица пакетов событий личной ленты, записанных до применения.
 * @returns Таблица с типизированными строками пакетов.
 */
export function pendingUserUpdatesTable(): Table<PendingUserUpdateRow, string> {
    return requireTable<PendingUserUpdateRow>("pending_user_updates");
}

/**
 * Служебное значение хранилища (ключ-значение).
 */
export interface MetaRow {

    /** Ключ значения. */
    key: string;

    /** Значение. */
    value: unknown;

}

/**
 * Таблица служебных значений (последний применённый upid личной ленты и т.п.).
 * @returns Таблица с типизированными строками.
 */
export function metaTable(): Table<MetaRow, string> {
    return requireTable<MetaRow>("meta");
}

/**
 * Ключ меты: последний применённый upid личной ленты событий.
 */
export const USER_FEED_UPTS_KEY = "user_feed_upts";

/**
 * Прочитать последний применённый upid личной ленты.
 * @returns Последний применённый upid (0 — лента ещё не читалась).
 */
export async function getUserFeedUpts(): Promise<number> {

    const row = await metaTable().get(USER_FEED_UPTS_KEY);
    return typeof row?.value === "number" ? row.value : 0;

}

/**
 * Сохранить последний применённый upid личной ленты.
 * @param upid - Позиция события.
 * @returns Promise<void>
 */
export async function setUserFeedUpts(upid: number): Promise<void> {
    await metaTable().put({ key: USER_FEED_UPTS_KEY, value: upid });
}

/**
 * Чистка служебных полей канала перед записью в IndexedDB.
 * @param data - Данные канала (запись стора либо пришедшая с сервера).
 * @returns Копия записи без служебных __-ключей.
 */
export function cleanChannel(data: ChannelRecord): ChannelRecord {

    // invariant: чистка удаляет только служебные __-ключи, структура
    // записи канала при этом не меняется
    return cleanStoreData(data) as ChannelRecord;

}

/**
 * Чистка служебных полей сообщения перед записью в IndexedDB.
 * @param data - Данные сообщения (запись стора либо пришедшая с сервера).
 * @returns Копия записи без служебных __-ключей.
 */
export function cleanMessage(data: MessageRecord): MessageRecord {

    // invariant: чистка удаляет только служебные __-ключи, структура
    // записи сообщения при этом не меняется
    return cleanStoreData(data) as MessageRecord;

}

/**
 * Полное сообщение обработчика записи: типизированы только id и клиентский
 * ключ идемпотентности, остальные поля уходят в базу как есть.
 */
export interface FullMessageRow extends StoreItem {

    /** Id сообщения (серверный). */
    id: string;

    /** Клиентский ключ идемпотентности (у своих исходящих — локальный id). */
    random_id?: string | null;

}

/**
 * ***************************************************************************
 * Записать полные сообщения в локальную БД (эхо событий, догонка, история)
 * и снять их записи очереди исходящих по `random_id`.
 * @param messages - Полные сообщения (любой источник).
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function putFullMessages(messages: FullMessageRow[]): Promise<void> {

    // Без инициализированной базы записывать некуда
    const db = IndexedDB.db;
    if (!db || messages.length === 0) return;

    // invariant: чистка удаляет только служебные __-ключи, структура
    // записи сообщения при этом не меняется
    const rows = messages.map((message) => cleanStoreData(message) as MessageRecord);
    await messagesTable().bulkPut(rows);

    // Снимаем записи очереди исходящих, чьи полные версии уже пришли
    const pendingIds = messages
        .map((message) => message.random_id)
        .filter((randomId): randomId is string => typeof randomId === "string" && randomId.length > 0);

    if (pendingIds.length > 0) {
        await pendingMessagesTable().bulkDelete(pendingIds);
    }

}
