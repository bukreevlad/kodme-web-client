// Импортируем сторонние пакеты
import type { Table } from "dexie";

// Импортируем utils
import { IndexedDB } from "../../utils/indexed_db.js";
import { cleanStoreData } from "../../utils/helpers/clean_store_data.js";

// Импортируем типы
import type { ChannelRecord, ChannelUpdateItem, MessageRecord } from "./types.js";

/**
 * ***************************************************************************
 * DB - доступ к таблицам IndexedDB главной формы.
 *
 * Схему задаёт utils/indexed_db; здесь таблицы берутся через обобщённый
 * `table<T>()`, чтобы строки были типизированы (легаси-доступ `db.channels`
 * давал бы `any`). Выполняется ровно тот же рантайм-путь: Dexie отдаёт
 * таблицу по имени из зарегистрированной схемы.
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
    data: ChannelUpdateItem[];

    /** Время записи пакета (мс). */
    timestamp: number;

}

/**
 * Доступ к таблице открытой базы.
 *
 * Без инициализированной БД читать нечего: раньше такой доступ давал
 * `undefined`, который падал с TypeError на первом же вызове метода
 * таблицы, поэтому отсутствие базы называется явно.
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
