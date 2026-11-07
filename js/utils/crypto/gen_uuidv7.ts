// Импортируем utils
import { randomBytes } from "./secret_crypto.js";

/**
 * Генерация UUIDv7 (48-битная метка времени + случайные биты, версия 7).
 * Нужен для id чатов/сообщений/файлов секретных чатов: сервер принимает
 * только UUIDv7, а генерировать их клиент должен локально.
 * @returns {string} - UUIDv7 в каноничном формате 8-4-4-4-12.
 */
export function genUuidv7(): string {

    // Метка времени (мс) занимает старшие 6 байт, остальное — случайные байты
    const bytes = randomBytes(16);
    const timestamp = Date.now();
    const view = new DataView(bytes.buffer);
    view.setUint32(0, Math.floor(timestamp / 0x100000000));
    view.setUint16(4, timestamp & 0xffff);

    // Фиксируем версию 7 и вариант RFC 4122
    bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
    bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);

    // Форматируем 8-4-4-4-12
    const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

}
