// Импортируем utils
import {
    createMessageNonce,
    createRandomNonce,
    decryptPayload,
    encryptPayload,
} from "../crypto/secret_crypto.js";

// Импортируем типы
import type { SecretMessageType } from "../../types/secret_chats.js";

/**
 * Статус активности собеседника («печатает…» и т.п.).
 */
export type SecretTypingStatus = "typing" | "recording_audio" | "recording_video" | "uploading_document";

/**
 * Control-сообщение протокола DataChannel секретного чата.
 */
export type SecretControlMessage =
    | SecretMsgControl
    | SecretMsgUpdateControl
    | SecretMsgRemoveControl
    | SecretReceiptControl
    | SecretTypingControl
    | SecretFileOfferControl
    | SecretFileDoneControl
    | SecretFileCancelControl
    | SecretPingControl
    | SecretPongControl
    | SecretKcControl;

/** Метаданные вложения в payload сообщения (уезжают собеседнику впереди файла). */
export interface SecretFileRef {

    /** Id файла (UUIDv7; файл летит чанками после сообщения). */
    file_id: string;

    /** Имя файла. */
    name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Размер в байтах. */
    size: number;

    /** Длительность медиа в миллисекундах (голосовые/кружки). */
    duration: number | null;

    /** Ширина (медиа). */
    width: number | null;

    /** Высота (медиа). */
    height: number | null;

    /** Миниатюра (data-URI) для мгновенного отображения до прихода файла. */
    thumbnail: string | null;

    /** Ширина миниатюры в пикселях (для подбора превью). */
    thumbnail_width: number | null;

    /** LQIP-placeholder (data-URI) под основной картинкой. */
    placeholder: string | null;

    /** Осциллограмма голосового (амплитуды 0..1). */
    wave_form: number[] | null;

    /** Флаги медиа (голосовое сообщение / видео-кружок). */
    flags: { is_audio_note?: boolean; is_video_note?: boolean } | null;

}

/** Payload сообщения (передаётся в control-кадре и хранится vault-шифротекстом). */
export interface SecretMessagePayload {
    /** Текст сообщения (для типа text). */
    text: string | null;
    /** Id файла (одиночное вложение/стикер). */
    file_id: string | null;
    /** Метаданные вложений (сообщение с файлами: metadata и миниатюры уходят впереди оригиналов). */
    files: SecretFileRef[] | null;
    /** Id сообщения, на которое дан ответ. */
    reply_to: string | null;
    /** Длительность медиа в миллисекундах (голосовые/кружки). */
    duration: number | null;
    /** Время создания (epoch ms, время отправителя). */
    created_at: number;
}

/** Новое сообщение. */
export interface SecretMsgControl {
    type: "msg";
    /** Id сообщения (UUIDv7, отправителя). */
    message_id: string;
    /** Тип сообщения. */
    msg_type: SecretMessageType;
    /** Payload сообщения. */
    payload: SecretMessagePayload;
}

/** Редактирование сообщения. */
export interface SecretMsgUpdateControl {
    type: "msg_update";
    /** Id сообщения. */
    message_id: string;
    /** Новый payload. */
    payload: SecretMessagePayload;
}

/** Удаление сообщения. */
export interface SecretMsgRemoveControl {
    type: "msg_remove";
    /** Id сообщения. */
    message_id: string;
}

/** Подтверждение доставки/просмотра. */
export interface SecretReceiptControl {
    type: "receipt";
    /** Id сообщений. */
    message_ids: string[];
    /** Статус: delivered — доставлено, read — просмотрено. */
    status: "delivered" | "read";
}

/** Активность собеседника («печатает…» и т.п.). */
export interface SecretTypingControl {
    type: "typing";
    /** Статус активности. */
    status: SecretTypingStatus;
}

/** Объявление файла перед передачей чанками. */
export interface SecretFileOfferControl {
    type: "file_offer";
    /** Id файла (UUIDv7). */
    file_id: string;
    /** Id сообщения, к которому прикреплён файл. */
    message_id: string;
    /** Имя файла. */
    name: string;
    /** MIME-тип. */
    mime_type: string;
    /** Размер в байтах. */
    size: number;
    /** Длительность медиа в мс (null — не медиа). */
    duration: number | null;
    /** Ширина кадра (null — не изображение/видео). */
    width: number | null;
    /** Высота кадра (null — не изображение/видео). */
    height: number | null;
}

/** Файл передан полностью. */
export interface SecretFileDoneControl {
    type: "file_done";
    /** Id файла. */
    file_id: string;
}

/** Отмена передачи файла. */
export interface SecretFileCancelControl {
    type: "file_cancel";
    /** Id файла. */
    file_id: string;
}

/** Keep-alive пинг. */
export interface SecretPingControl {
    type: "ping";
}

/** Keep-alive понг. */
export interface SecretPongControl {
    type: "pong";
}

/** Подтверждение ключа handshake (HMAC). */
export interface SecretKcControl {
    type: "kc";
    /** Подтверждение (base64url HMAC-SHA-256). */
    value: string;
}

/**
 * Расшифрованный кадр DataChannel.
 */
export type SecretFrame =
    | { kind: "control"; control: SecretControlMessage }
    | { kind: "file_chunk"; fileId: string; index: number; data: Uint8Array<ArrayBuffer> };

// Маркер типа кадра: control-сообщение (JSON внутри шифра)
export const FRAME_CONTROL = 0x01;

// Маркер типа кадра: чанк файла
export const FRAME_FILE_CHUNK = 0x02;

// Маркер типа кадра: часть большого кадра (дробление под лимит сообщения канала)
export const FRAME_PART = 0x03;

// Максимальный размер кадра (байт): безопасный лимит одного сообщения
// RTCDataChannel для всех браузеров (64 КиБ). Бо́льшее сообщение отправитель
// получает ошибкой «Message too large», а принимающая сторона — обрезанным
// кадром. Кадры крупнее лимита дробятся на части (splitFrame/FrameAssembler).
export const MAX_FRAME_SIZE = 64 * 1024;

// Длина заголовка части кадра: [0x03][index 2][count 2]
const PART_HEADER_LENGTH = 5;

// Длина двоичного id файла (UUID → 16 байт) в кадре чанка
const FILE_ID_LENGTH = 16;

// Длина индекса чанка (4 байта, big-endian) в кадре
const INDEX_LENGTH = 4;

// Типы control-сообщений (для проверки разобранных кадров)
const CONTROL_TYPES = new Set([
    "msg", "msg_update", "msg_remove", "receipt", "typing",
    "file_offer", "file_done", "file_cancel", "ping", "pong", "kc",
]);

// Типы сообщений секретного чата (для проверки msg-кадров)
const MESSAGE_TYPES: ReadonlySet<string> = new Set([
    "text", "sticker", "image", "video", "document", "voice_note", "video_note", "service",
]);

// Статусы активности собеседника
const TYPING_STATUSES: ReadonlySet<string> = new Set(["typing", "recording_audio", "recording_video", "uploading_document"]);

/**
 * Значение — допустимый тип сообщения секретного чата.
 * @param {string} value - Проверяемое значение.
 * @returns {boolean} - true, если тип известен протоколу.
 */
function isMessageType(value: string): value is SecretMessageType {
    return MESSAGE_TYPES.has(value);
}

/**
 * Значение — допустимый статус активности собеседника.
 * @param {string} value - Проверяемое значение.
 * @returns {boolean} - true, если статус известен протоколу.
 */
function isTypingStatus(value: string): value is SecretTypingStatus {
    return TYPING_STATUSES.has(value);
}

// ===========================================================================
// UUID ↔ байты (для двоичного id файла в кадре)
// ===========================================================================

/**
 * Кодирование UUID в 16 байт.
 * @param {string} uuid - UUID в формате 8-4-4-4-12.
 * @returns {Uint8Array} - 16 байтов.
 */
export function uuidToBytes(uuid: string): Uint8Array<ArrayBuffer> {
    const hex = uuid.replace(/-/g, "");
    if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("Некорректный UUID файла");
    const bytes = new Uint8Array(FILE_ID_LENGTH);
    for (let i = 0; i < FILE_ID_LENGTH; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * Декодирование 16 байт в UUID.
 * @param {Uint8Array} bytes - 16 байтов.
 * @returns {string} - UUID в формате 8-4-4-4-12.
 */
export function bytesToUuid(bytes: Uint8Array<ArrayBuffer>): string {
    if (bytes.length !== FILE_ID_LENGTH) throw new Error("Некорректная длина id файла");
    const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ===========================================================================
// Кодирование / декодирование кадров
// ===========================================================================

/**
 * Кодирование control-кадра: [0x01][nonce||ciphertext JSON].
 * @param {CryptoKey} sessionKey - Ключ сессии (AES-256-GCM).
 * @param {string} chatId - Id чата (AAD).
 * @param {number} counter - Счётчик кадров соединения (nonce).
 * @param {SecretControlMessage} control - Control-сообщение.
 * @returns {Promise<Uint8Array>} - Кадр.
 */
export async function encodeControlFrame(
    sessionKey: CryptoKey,
    chatId: string,
    counter: number,
    control: SecretControlMessage,
): Promise<Uint8Array<ArrayBuffer>> {
    const plaintext = new TextEncoder().encode(JSON.stringify(control));
    const payload = await encryptPayload(sessionKey, createMessageNonce(counter), plaintext, new TextEncoder().encode(chatId));
    const frame = new Uint8Array(1 + payload.length);
    frame[0] = FRAME_CONTROL;
    frame.set(payload, 1);
    return frame;
}

/**
 * Кодирование кадра чанка файла: [0x02][file_id 16][index 4][nonce||ciphertext].
 * @param {CryptoKey} sessionKey - Ключ сессии (AES-256-GCM).
 * @param {string} chatId - Id чата (AAD).
 * @param {string} fileId - Id файла (UUIDv7).
 * @param {number} index - Порядковый номер чанка.
 * @param {Uint8Array} data - Открытые байты чанка.
 * @returns {Promise<Uint8Array>} - Кадр.
 */
export async function encodeFileChunkFrame(
    sessionKey: CryptoKey,
    chatId: string,
    fileId: string,
    index: number,
    data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const idBytes = uuidToBytes(fileId);
    const indexBytes = new Uint8Array(INDEX_LENGTH);
    new DataView(indexBytes.buffer).setUint32(0, index, false);
    const payload = await encryptPayload(sessionKey, createRandomNonce(), data, new TextEncoder().encode(chatId));
    const frame = new Uint8Array(1 + FILE_ID_LENGTH + INDEX_LENGTH + payload.length);
    frame[0] = FRAME_FILE_CHUNK;
    frame.set(idBytes, 1);
    frame.set(indexBytes, 1 + FILE_ID_LENGTH);
    frame.set(payload, 1 + FILE_ID_LENGTH + INDEX_LENGTH);
    return frame;
}

/**
 * Декодирование кадра DataChannel (control или чанк файла).
 * @param {CryptoKey} sessionKey - Ключ сессии (AES-256-GCM).
 * @param {string} chatId - Id чата (AAD).
 * @param {Uint8Array} frame - Кадр.
 * @returns {Promise<SecretFrame>} - Расшифрованный кадр.
 */
export async function decodeFrame(
    sessionKey: CryptoKey,
    chatId: string,
    frame: Uint8Array<ArrayBuffer>,
): Promise<SecretFrame> {

    const kind = frame[0];
    const aad = new TextEncoder().encode(chatId);

    // Control-кадр: зашифрованный JSON
    if (kind === FRAME_CONTROL) {
        const plaintext = await decryptPayload(sessionKey, frame.subarray(1), aad);
        return { kind: "control", control: parseSecretControlMessage(JSON.parse(new TextDecoder().decode(plaintext))) };
    }

    // Кадр чанка файла
    if (kind === FRAME_FILE_CHUNK) {
        const headerLength = 1 + FILE_ID_LENGTH + INDEX_LENGTH;
        if (frame.length <= headerLength) throw new Error("Кадр чанка короче заголовка");
        const fileId = bytesToUuid(frame.subarray(1, 1 + FILE_ID_LENGTH));
        const index = new DataView(frame.buffer, frame.byteOffset + 1 + FILE_ID_LENGTH, INDEX_LENGTH).getUint32(0, false);
        const data = await decryptPayload(sessionKey, frame.subarray(headerLength), aad);
        return { kind: "file_chunk", fileId, index, data };
    }

    throw new Error("Неизвестный тип кадра");

}

// ===========================================================================
// Дробление кадров под лимит сообщения канала данных
// ===========================================================================

/**
 * ***************************************************************************
 * splitFrame - дробление кадра на части под лимит сообщения канала данных.
 * Кадры, не превышающие лимит, возвращаются как есть (одна часть).
 * @param {Uint8Array} frame - Кадр.
 * @returns {Uint8Array[]} - Части кадра для последовательной отправки.
 * ***************************************************************************
 */
export function splitFrame(frame: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>[] {

    if (frame.length <= MAX_FRAME_SIZE) return [frame];

    const dataMax = MAX_FRAME_SIZE - PART_HEADER_LENGTH;
    const count = Math.ceil(frame.length / dataMax);
    const parts: Uint8Array<ArrayBuffer>[] = [];

    for (let index = 0; index < count; index++) {
        const data = frame.subarray(index * dataMax, Math.min((index + 1) * dataMax, frame.length));
        const part = new Uint8Array(PART_HEADER_LENGTH + data.length);
        part[0] = FRAME_PART;
        new DataView(part.buffer).setUint16(1, index, false);
        new DataView(part.buffer).setUint16(3, count, false);
        part.set(data, PART_HEADER_LENGTH);
        parts.push(part);
    }

    return parts;

}

/**
 * ***************************************************************************
 * FrameAssembler - сборщик кадров, пришедших частями.
 *
 * Отправка частей сериализована (все части уходят одним куском кода, а
 * канал ordered), поэтому части одного кадра приходят подряд и в порядке
 * следования. Обычные кадры проходят насквозь.
 * ***************************************************************************
 */
export class FrameAssembler {

    /** Принятые части по индексам. */
    private parts: (Uint8Array<ArrayBuffer> | undefined)[] = [];

    /** Сколько частей ожидается в собираемом кадре. */
    private total = 0;

    /**
     * ***************************************************************************
     * Приём кадра: обычный возвращается как есть, часть — накапливается до
     * полного кадра.
     * @param {Uint8Array} frame - Кадр из канала.
     * @returns {Uint8Array | null} - Полный кадр либо null (часть принята).
     * ***************************************************************************
     */
    push(frame: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> | null {

        // Обычный кадр (идёт вне дробления)
        if (frame[0] !== FRAME_PART) return frame;

        // Заголовок части обязателен: без него кадр не собрать
        if (frame.length <= PART_HEADER_LENGTH) throw new Error("Кадр части короче заголовка");

        const view = new DataView(frame.buffer, frame.byteOffset, frame.length);
        const index = view.getUint16(1, false);
        const count = view.getUint16(3, false);
        if (count < 1 || index >= count) throw new Error("Некорректный заголовок части кадра");

        // Новый кадр начинается с нулевой части (части уходят подряд)
        if (index === 0) {
            this.parts = [];
            this.total = count;
        }
        if (this.total !== count) throw new Error("Части разных кадров перемешались");

        this.parts[index] = frame.subarray(PART_HEADER_LENGTH);

        // Ждём все части: дырявый массив проверяем обходом по индексам
        for (let i = 0; i < this.total; i++) {
            if (!this.parts[i]) return null;
        }

        // Собираем кадр целиком
        let totalLength = 0;
        for (let i = 0; i < this.total; i++) {
            totalLength += this.parts[i]?.length ?? 0;
        }
        const assembled = new Uint8Array(totalLength);
        let offset = 0;
        for (let i = 0; i < this.total; i++) {
            const part = this.parts[i];
            if (!part) continue;
            assembled.set(part, offset);
            offset += part.length;
        }

        this.parts = [];
        this.total = 0;
        return assembled;

    }

}

// ===========================================================================
// Разбор control-сообщений (внешние данные — только через проверки)
// ===========================================================================

/**
 * Значение — plain-объект.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение — объект.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Обязательное строковое поле объекта.
 * @param {Record<string, unknown>} value - Объект.
 * @param {string} field - Имя поля.
 * @returns {string} - Значение поля.
 */
function readString(value: Record<string, unknown>, field: string): string {
    const item = value[field];
    if (typeof item !== "string") throw new Error(`Некорректное поле control-кадра: ${field}`);
    return item;
}

/**
 * Обязательное числовое поле объекта.
 * @param {Record<string, unknown>} value - Объект.
 * @param {string} field - Имя поля.
 * @returns {number} - Значение поля.
 */
function readNumber(value: Record<string, unknown>, field: string): number {
    const item = value[field];
    if (typeof item !== "number") throw new Error(`Некорректное поле control-кадра: ${field}`);
    return item;
}

/**
 * Необязательное строковое поле (null — отсутствует).
 * @param {Record<string, unknown>} value - Объект.
 * @param {string} field - Имя поля.
 * @returns {string | null} - Значение поля.
 */
function readNullableString(value: Record<string, unknown>, field: string): string | null {
    const item = value[field];
    if (item === null || item === undefined) return null;
    if (typeof item !== "string") throw new Error(`Некорректное поле control-кадра: ${field}`);
    return item;
}

/**
 * Необязательное числовое поле (null — отсутствует).
 * @param {Record<string, unknown>} value - Объект.
 * @param {string} field - Имя поля.
 * @returns {number | null} - Значение поля.
 */
function readNullableNumber(value: Record<string, unknown>, field: string): number | null {
    const item = value[field];
    if (item === null || item === undefined) return null;
    if (typeof item !== "number") throw new Error(`Некорректное поле control-кадра: ${field}`);
    return item;
}

/**
 * Разбор метаданных вложения из payload сообщения.
 * @param {unknown} value - Значение из JSON.
 * @returns {SecretFileRef} - Метаданные вложения.
 */
export function parseFileRef(value: unknown): SecretFileRef {
    if (!isRecord(value)) throw new Error("Некорректные метаданные вложения");

    // Флаги медиа: только известные boolean-флаги
    let flags: SecretFileRef["flags"] = null;
    const rawFlags = value.flags;
    if (isRecord(rawFlags)) {
        flags = {
            ...(rawFlags.is_audio_note === true ? { is_audio_note: true } : {}),
            ...(rawFlags.is_video_note === true ? { is_video_note: true } : {}),
        };
    }

    // Осциллограмма голосового: массив чисел 0..1
    let waveForm: number[] | null = null;
    const rawWave = value.wave_form;
    if (Array.isArray(rawWave)) {
        waveForm = rawWave.filter((point): point is number => typeof point === "number" && Number.isFinite(point));
    }

    return {
        file_id: readString(value, "file_id"),
        name: readString(value, "name"),
        mime_type: readString(value, "mime_type"),
        size: readNumber(value, "size"),
        duration: readNullableNumber(value, "duration"),
        width: readNullableNumber(value, "width"),
        height: readNullableNumber(value, "height"),
        thumbnail: readNullableString(value, "thumbnail"),
        thumbnail_width: readNullableNumber(value, "thumbnail_width"),
        placeholder: readNullableString(value, "placeholder"),
        wave_form: waveForm,
        flags: flags,
    };
}

/**
 * Разбор payload сообщения из control-кадра.
 * @param {unknown} value - Значение из JSON.
 * @returns {SecretMessagePayload} - Payload сообщения.
 */
export function parseMessagePayload(value: unknown): SecretMessagePayload {
    if (!isRecord(value)) throw new Error("Некорректный payload сообщения");

    // Вложения: массив метаданных (null — сообщение без файлов)
    let files: SecretFileRef[] | null = null;
    const rawFiles = value.files;
    if (rawFiles !== null && rawFiles !== undefined) {
        if (!Array.isArray(rawFiles)) throw new Error("Некорректное поле control-кадра: files");
        files = rawFiles.map((item) => parseFileRef(item));
    }

    return {
        text: readNullableString(value, "text"),
        file_id: readNullableString(value, "file_id"),
        files: files,
        reply_to: readNullableString(value, "reply_to"),
        duration: readNullableNumber(value, "duration"),
        created_at: readNumber(value, "created_at"),
    };
}

/**
 * Разбор control-сообщения из расшифрованного JSON кадра.
 * @param {unknown} value - Значение из JSON.
 * @returns {SecretControlMessage} - Control-сообщение.
 */
export function parseSecretControlMessage(value: unknown): SecretControlMessage {

    if (!isRecord(value)) throw new Error("Некорректный control-кадр");
    const type = value.type;
    if (typeof type !== "string" || !CONTROL_TYPES.has(type)) throw new Error("Неизвестный тип control-кадра");

    switch (type) {

        case "msg": {
            const msgType = readString(value, "msg_type");
            if (!isMessageType(msgType)) throw new Error("Некорректный тип сообщения");
            return {
                type: "msg",
                message_id: readString(value, "message_id"),
                msg_type: msgType,
                payload: parseMessagePayload(value.payload),
            };
        }

        case "msg_update":
            return {
                type: "msg_update",
                message_id: readString(value, "message_id"),
                payload: parseMessagePayload(value.payload),
            };

        case "msg_remove":
            return { type: "msg_remove", message_id: readString(value, "message_id") };

        case "receipt": {
            const status = readString(value, "status");
            if (status !== "delivered" && status !== "read") throw new Error("Некорректный статус receipt");
            const ids = value.message_ids;
            if (!Array.isArray(ids) || !ids.every((item) => typeof item === "string")) {
                throw new Error("Некорректное поле control-кадра: message_ids");
            }
            return { type: "receipt", message_ids: ids, status };
        }

        case "typing": {
            const status = readString(value, "status");
            if (!isTypingStatus(status)) throw new Error("Некорректный статус typing");
            return { type: "typing", status };
        }

        case "file_offer":
            return {
                type: "file_offer",
                file_id: readString(value, "file_id"),
                message_id: readString(value, "message_id"),
                name: readString(value, "name"),
                mime_type: readString(value, "mime_type"),
                size: readNumber(value, "size"),
                duration: readNullableNumber(value, "duration"),
                width: readNullableNumber(value, "width"),
                height: readNullableNumber(value, "height"),
            };

        case "file_done":
            return { type: "file_done", file_id: readString(value, "file_id") };

        case "file_cancel":
            return { type: "file_cancel", file_id: readString(value, "file_id") };

        case "ping":
            return { type: "ping" };

        case "pong":
            return { type: "pong" };

        default:
            return { type: "kc", value: readString(value, "value") };

    }

}
