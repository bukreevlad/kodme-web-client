// Импортируем utils
import { base64urlToBuffer, bufferToBase64url } from "../helpers/webauthn.js";
import { compareBytes, concatBytes, sha256 } from "./secret_crypto.js";

/**
 * Данные QR-кода верификации секретного чата.
 */
export interface SecretVerificationPayload {
    /** Версия формата payload. */
    version: number;
    /** Отпечаток пары ключей идентичности (32 байта) в base64url. */
    fingerprint: string;
    /** Собственный публичный ключ идентичности (SPKI) в base64url. */
    identity: string;
}

// Словарь эмодзи для отображения отпечатка (ровно 64 значения)
const FINGERPRINT_EMOJI: readonly string[] = [
    "🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🥝",
    "🍑", "🍍", "🥑", "🌶", "🌸", "🌼", "🌻", "🌙",
    "⭐", "⚡", "❄️", "🔥", "💧", "🌊", "🎈", "🎁",
    "🎉", "🎯", "🎲", "🎸", "🎹", "🎺", "🚀", "🚗",
    "✈️", "⛵", "🏠", "🏰", "🗝", "🔔", "🎩", "👓",
    "🧭", "⌚", "📷", "📚", "✏️", "📌", "🧲", "🪙",
    "💎", "🏆", "🎗", "🧩", "🎨", "🖌", "🌵", "🌴",
    "🦊", "🐻", "🐼", "🦁", "🐸", "🐙", "🦋", "🐝",
];

// Количество эмодзи в отображении отпечатка
const EMOJI_COUNT = 4;

// Длина отпечатка в байтах (SHA-256)
const FINGERPRINT_LENGTH = 32;

/**
 * Вычисление отпечатка пары ключей идентичности двух устройств.
 * Порядок аргументов не важен: ключи сортируются перед хэшированием.
 * @param {Uint8Array} identityA - Публичный ключ идентичности первого устройства (SPKI).
 * @param {Uint8Array} identityB - Публичный ключ идентичности второго устройства (SPKI).
 * @returns {Promise<Uint8Array>} - Отпечаток (32 байта).
 */
export async function computeFingerprint(
    identityA: Uint8Array<ArrayBuffer>,
    identityB: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const [first, second] = compareBytes(identityA, identityB) <= 0
        ? [identityA, identityB]
        : [identityB, identityA];
    return sha256(concatBytes(first, second));
}

/**
 * Отображение отпечатка в 4 эмодзи для сверки участниками (как в Telegram).
 * @param {Uint8Array} fingerprint - Отпечаток (32 байта).
 * @returns {string[]} - Массив из 4 эмодзи.
 */
export function fingerprintToEmoji(fingerprint: Uint8Array<ArrayBuffer>): string[] {
    if (fingerprint.length < EMOJI_COUNT) throw new Error("Отпечаток короче 4 байт");
    const emoji: string[] = [];
    for (let i = 0; i < EMOJI_COUNT; i++) {
        const byte = fingerprint[i] ?? 0;
        const item = FINGERPRINT_EMOJI[byte % FINGERPRINT_EMOJI.length];
        if (item === undefined) throw new Error("Словарь эмодзи повреждён");
        emoji.push(item);
    }
    return emoji;
}

/**
 * Отображение отпечатка в hex-строку (текстовый вариант сверки).
 * @param {Uint8Array} fingerprint - Отпечаток (32 байта).
 * @returns {string} - Hex-строка без разделителей.
 */
export function fingerprintToHex(fingerprint: Uint8Array<ArrayBuffer>): string {
    return Array.from(fingerprint).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Формирование payload QR-кода верификации (генерация QR — строго на клиенте,
 * отпечаток не покидает устройства).
 * @param {Uint8Array} fingerprint - Отпечаток пары ключей (32 байта).
 * @param {Uint8Array} identityPublic - Собственный публичный ключ идентичности (SPKI).
 * @returns {string} - Payload для QR-кода (base64url).
 */
export function createVerificationPayload(
    fingerprint: Uint8Array<ArrayBuffer>,
    identityPublic: Uint8Array<ArrayBuffer>,
): string {
    if (fingerprint.length !== FINGERPRINT_LENGTH) throw new Error("Отпечаток должен быть 32 байта");
    const payload: SecretVerificationPayload = {
        version: 1,
        fingerprint: bufferToBase64url(fingerprint),
        identity: bufferToBase64url(identityPublic),
    };
    return bufferToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
}

/**
 * Разбор payload QR-кода верификации (например, после сканирования).
 * @param {string} value - Payload из QR-кода (base64url).
 * @returns {SecretVerificationPayload} - Разобранные данные.
 */
export function parseVerificationPayload(value: string): SecretVerificationPayload {

    // Декодируем и разбираем JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(new TextDecoder().decode(base64urlToBuffer(value)));
    } catch {
        throw new Error("Некорректный QR-код верификации");
    }

    // Валидируем структуру payload
    if (typeof parsed !== "object" || parsed === null) throw new Error("Некорректный QR-код верификации");
    if (!("version" in parsed) || typeof parsed.version !== "number") throw new Error("Некорректный QR-код верификации");
    if (!("fingerprint" in parsed) || typeof parsed.fingerprint !== "string") throw new Error("Некорректный QR-код верификации");
    if (!("identity" in parsed) || typeof parsed.identity !== "string") throw new Error("Некорректный QR-код верификации");

    return {
        version: parsed.version,
        fingerprint: parsed.fingerprint,
        identity: parsed.identity,
    };

}
