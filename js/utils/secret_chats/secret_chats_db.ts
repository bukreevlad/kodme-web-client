// Импортируем сторонние пакеты
import type { Table } from "dexie";

// Импортируем utils
import { IndexedDB } from "../indexed_db.js";
import { Vault } from "../crypto/vault.js";

// Импортируем типы
import type { SecretChatRecord, SecretFileRecord, SecretMessageRecord } from "../../types/secret_chats.js";

/**
 * ***************************************************************************
 * DB - доступ к таблицам IndexedDB секретных чатов.
 *
 * Таблицы задаёт utils/indexed_db (схема v6): секретные чаты, сообщения и
 * файлы живут только локально и хранятся vault-шифротекстом. Как и в
 * forms/main/db.ts, строки типизируются через обобщённый `table<T>()`.
 * ***************************************************************************
 */

/**
 * Доступ к таблице открытой базы.
 * @param {string} name - Имя таблицы в схеме.
 * @returns {Table} - Таблица с типизированными строками.
 */
function requireTable<T>(name: string): Table<T, string> {

    const db = IndexedDB.db;
    if (!db) {
        throw new Error(`[app][IndexedDB]: База данных не инициализирована — таблица "${name}" недоступна.`);
    }

    return db.table<T, string>(name);

}

/**
 * Таблица секретных чатов.
 * @returns {Table} - Таблица с типизированными строками чатов.
 */
export function secretChatsTable(): Table<SecretChatRecord, string> {
    return requireTable<SecretChatRecord>("secret_chats");
}

/**
 * Таблица сообщений секретных чатов.
 * @returns {Table} - Таблица с типизированными строками сообщений.
 */
export function secretMessagesTable(): Table<SecretMessageRecord, string> {
    return requireTable<SecretMessageRecord>("secret_messages");
}

/**
 * Таблица файлов секретных чатов.
 * @returns {Table} - Таблица с типизированными строками файлов.
 */
export function secretFilesTable(): Table<SecretFileRecord, string> {
    return requireTable<SecretFileRecord>("secret_files");
}

/**
 * ***************************************************************************
 * wipeSecretChatsData - полная очистка данных секретных чатов сессии:
 * записи чатов, сообщений и файлов плюс vault-ключ локального хранилища.
 * По политике сессии секретные данные живут только внутри неё — при
 * удалении сессии (полный выход) они стираются.
 * @param {string} sessionId - Id сессии (владелец vault-ключа).
 * @returns {Promise<void>}
 * ***************************************************************************
 */
export async function wipeSecretChatsData(sessionId: string): Promise<void> {

    await secretMessagesTable().clear();
    await secretFilesTable().clear();
    await secretChatsTable().clear();
    Vault.delete(sessionId);

}
