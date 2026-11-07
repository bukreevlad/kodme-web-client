// Импортируем utils
import { Logger } from "../logs/logger.js";
import { base64urlToBuffer, bufferToBase64url } from "../helpers/webauthn.js";
import {
    createChunkNonce,
    createRandomNonce,
    decryptPayload,
    encryptPayload,
    equalBytes,
    importAesKey,
    randomBytes,
} from "./secret_crypto.js";

// Длина vault-ключа AES-256 в байтах
const VAULT_KEY_LENGTH = 32;

// ===========================================================================
// Чистые функции шифрования локальных данных (работают с переданным ключом)
// ===========================================================================

/**
 * Шифрование JSON-значения для локального хранилища (nonce случайный,
 * блок вида nonce || ciphertext).
 * @param {CryptoKey} key - Ключ локального хранилища (AES-256-GCM).
 * @param {unknown} value - Значение любого JSON-совместимого типа.
 * @returns {Promise<Uint8Array>} - Зашифрованный блок.
 */
export async function encryptJsonValue(
    key: CryptoKey,
    value: unknown,
): Promise<Uint8Array<ArrayBuffer>> {
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    return encryptPayload(key, createRandomNonce(), plaintext);
}

/**
 * Расшифровка JSON-значения из локального хранилища.
 * @param {CryptoKey} key - Ключ локального хранилища (AES-256-GCM).
 * @param {Uint8Array} payload - Зашифрованный блок.
 * @returns {Promise<unknown>} - Расшифрованное значение.
 */
export async function decryptJsonValue(
    key: CryptoKey,
    payload: Uint8Array<ArrayBuffer>,
): Promise<unknown> {
    const plaintext = await decryptPayload(key, payload);
    return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Шифрование чанка файла для локального хранилища.
 * @param {CryptoKey} key - Ключ локального хранилища (AES-256-GCM).
 * @param {Uint8Array} salt - Соль файла (8 байт, одна на весь файл).
 * @param {number} index - Порядковый номер чанка.
 * @param {Uint8Array} data - Открытые байты чанка.
 * @returns {Promise<Uint8Array>} - Зашифрованный блок (nonce || ciphertext).
 */
export async function encryptFileChunk(
    key: CryptoKey,
    salt: Uint8Array<ArrayBuffer>,
    index: number,
    data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    return encryptPayload(key, createChunkNonce(salt, index), data);
}

/**
 * Расшифровка чанка файла из локального хранилища.
 * @param {CryptoKey} key - Ключ локального хранилища (AES-256-GCM).
 * @param {Uint8Array} salt - Соль файла (8 байт).
 * @param {number} index - Порядковый номер чанка.
 * @param {Uint8Array} payload - Зашифрованный блок.
 * @returns {Promise<Uint8Array>} - Открытые байты чанка.
 */
export async function decryptFileChunk(
    key: CryptoKey,
    salt: Uint8Array<ArrayBuffer>,
    index: number,
    payload: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    // Блок должен быть зашифрован именно этой солью и этим индексом
    const expected = createChunkNonce(salt, index);
    if (!equalBytes(payload.subarray(0, expected.length), expected)) {
        throw new Error("Чанк не соответствует соли/индексу файла");
    }
    return decryptPayload(key, payload);
}

// ===========================================================================
// Vault - ключ шифрования локального хранилища секретных чатов.
// ===========================================================================

/**
 * ***************************************************************************
 * Vault - ключ шифрования локального хранилища секретных чатов (IndexedDB).
 *
 * Ключ (AES-256-GCM) генерируется при первом обращении и хранится в
 * localStorage сессии. Защищает данные секретных чатов на диске от чтения
 * БД/бэкапов; при выходе из сессии удаляется вместе с данными.
 * ***************************************************************************
 */
export class Vault {

    /** Ключ локального хранилища (AES-256-GCM) или null до инициализации. */
    static key: CryptoKey | null = null;

    /**
     * ***************************************************************************
     * Имя ключа в localStorage для сессии.
     * @param {string} sessionId - Id сессии.
     * @returns {string} - Имя ключа.
     * ***************************************************************************
     */
    static storageKeyName(sessionId: string): string {
        return `codeme::secret_vault::${sessionId}`;
    }

    /**
     * ***************************************************************************
     * Инициализация: загрузка vault-ключа из localStorage или его генерация.
     * @param {string} sessionId - Id сессии.
     * ***************************************************************************
     */
    static async initial(sessionId: string): Promise<void> {

        // Проверяем инициализирован ли ключ
        if (this.key) {
            Logger.warn("[app][Vault]: Ключ локального хранилища уже инициализирован.");
            return;
        }

        const stored = localStorage.getItem(this.storageKeyName(sessionId));

        // Ключ уже есть — импортируем
        if (stored) {
            this.key = await importAesKey(base64urlToBuffer(stored));
            Logger.debug("[app][Vault]: Ключ локального хранилища загружен.");
            return;
        }

        // Первый запуск: генерируем ключ и сохраняем
        const raw = randomBytes(VAULT_KEY_LENGTH);
        localStorage.setItem(this.storageKeyName(sessionId), bufferToBase64url(raw));
        this.key = await importAesKey(raw);
        Logger.debug("[app][Vault]: Ключ локального хранилища создан.");

    }

    /**
     * ***************************************************************************
     * Удаление vault-ключа (при выходе из сессии).
     * @param {string} sessionId - Id сессии.
     * ***************************************************************************
     */
    static delete(sessionId: string): void {
        localStorage.removeItem(this.storageKeyName(sessionId));
        this.key = null;
        Logger.debug("[app][Vault]: Ключ локального хранилища удалён.");
    }

    /**
     * ***************************************************************************
     * Получение инициализированного ключа.
     * @returns {CryptoKey} - Ключ локального хранилища.
     * ***************************************************************************
     */
    static getKey(): CryptoKey {
        if (!this.key) throw new Error("Ключ локального хранилища не инициализирован");
        return this.key;
    }

    /**
     * ***************************************************************************
     * Шифрование JSON-значения vault-ключом.
     * @param {unknown} value - Значение для шифрования.
     * @returns {Promise<Uint8Array>} - Зашифрованный блок.
     * ***************************************************************************
     */
    static async encryptJson(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
        return encryptJsonValue(this.getKey(), value);
    }

    /**
     * ***************************************************************************
     * Расшифровка JSON-значения vault-ключом.
     * @param {Uint8Array} payload - Зашифрованный блок.
     * @returns {Promise<unknown>} - Расшифрованное значение.
     * ***************************************************************************
     */
    static async decryptJson(payload: Uint8Array<ArrayBuffer>): Promise<unknown> {
        return decryptJsonValue(this.getKey(), payload);
    }

    /**
     * ***************************************************************************
     * Шифрование чанка файла vault-ключом.
     * @param {Uint8Array} salt - Соль файла (8 байт).
     * @param {number} index - Порядковый номер чанка.
     * @param {Uint8Array} data - Открытые байты чанка.
     * @returns {Promise<Uint8Array>} - Зашифрованный блок.
     * ***************************************************************************
     */
    static async encryptChunk(
        salt: Uint8Array<ArrayBuffer>,
        index: number,
        data: Uint8Array<ArrayBuffer>,
    ): Promise<Uint8Array<ArrayBuffer>> {
        return encryptFileChunk(this.getKey(), salt, index, data);
    }

    /**
     * ***************************************************************************
     * Расшифровка чанка файла vault-ключом.
     * @param {Uint8Array} salt - Соль файла (8 байт).
     * @param {number} index - Порядковый номер чанка.
     * @param {Uint8Array} payload - Зашифрованный блок.
     * @returns {Promise<Uint8Array>} - Открытые байты чанка.
     * ***************************************************************************
     */
    static async decryptChunk(
        salt: Uint8Array<ArrayBuffer>,
        index: number,
        payload: Uint8Array<ArrayBuffer>,
    ): Promise<Uint8Array<ArrayBuffer>> {
        return decryptFileChunk(this.getKey(), salt, index, payload);
    }

}
