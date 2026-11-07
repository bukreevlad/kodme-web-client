/**
 * Пара ключей ECDH (P-256) секретного чата.
 */
export interface SecretKeyPair {
    /** Приватный ключ ECDH. */
    privateKey: CryptoKey;
    /** Публичный ключ в кодировке SPKI (DER). */
    publicKey: Uint8Array<ArrayBuffer>;
}

// Кривая ECDH всех ключей секретных чатов
const ECDH_CURVE = "P-256";

// Длина nonce AES-GCM в байтах
const NONCE_LENGTH = 12;

// Длина соли чанков файла в байтах
const CHUNK_SALT_LENGTH = 8;

// Длина ключа AES-256-GCM в байтах
const AES_KEY_LENGTH = 32;

// ===========================================================================
// Байтовые утилиты
// ===========================================================================

/**
 * Генерация криптографически случайных байтов.
 * @param {number} length - Требуемая длина в байтах.
 * @returns {Uint8Array} - Массив случайных байтов.
 */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Склейка нескольких массивов байтов в один.
 * @param {...Uint8Array} parts - Части для склейки.
 * @returns {Uint8Array} - Результирующий массив.
 */
export function concatBytes(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

/**
 * Лексикографическое сравнение двух массивов байтов (канонический порядок
 * ключей идентичности для handshake и отпечатка).
 * @param {Uint8Array} a - Первый массив.
 * @param {Uint8Array} b - Второй массив.
 * @returns {number} - Отрицательное/0/положительное как у strcmp.
 */
export function compareBytes(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): number {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return a.length - b.length;
}

/**
 * Побайтовое сравнение «в постоянное время» (без раннего выхода) — для
 * проверки значений HMAC/подтверждений.
 * @param {Uint8Array} a - Первый массив.
 * @param {Uint8Array} b - Второй массив.
 * @returns {boolean} - true, если массивы совпадают.
 */
export function equalBytes(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diff === 0;
}

// ===========================================================================
// Nonce (IV) для AES-GCM
// ===========================================================================

/**
 * Случайный nonce для шифрования локальных данных (vault).
 * @returns {Uint8Array} - Nonce из 12 байтов.
 */
export function createRandomNonce(): Uint8Array<ArrayBuffer> {
    return randomBytes(NONCE_LENGTH);
}

/**
 * Nonce сообщения: старшие 4 байта — счётчик сообщений в чате (контроль
 * повторов на приёме), младшие 8 байт — случайные.
 * @param {number} counter - Счётчик сообщений (32 бита).
 * @returns {Uint8Array} - Nonce из 12 байтов.
 */
export function createMessageNonce(counter: number): Uint8Array<ArrayBuffer> {
    const nonce = randomBytes(NONCE_LENGTH);
    new DataView(nonce.buffer).setUint32(0, counter >>> 0, false);
    return nonce;
}

/**
 * Чтение счётчика сообщений из зашифрованного блока (nonce || ciphertext).
 * @param {Uint8Array} payload - Зашифрованный блок.
 * @returns {number} - Значение счётчика из nonce.
 */
export function readMessageNonceCounter(payload: Uint8Array<ArrayBuffer>): number {
    if (payload.length < NONCE_LENGTH) throw new Error("Зашифрованный блок короче nonce");
    return new DataView(payload.buffer, payload.byteOffset, NONCE_LENGTH).getUint32(0, false);
}

/**
 * Случайная соль чанков файла (одна на файл, часть nonce каждого чанка).
 * @returns {Uint8Array} - Соль из 8 байтов.
 */
export function createChunkSalt(): Uint8Array<ArrayBuffer> {
    return randomBytes(CHUNK_SALT_LENGTH);
}

/**
 * Nonce чанка файла: 8 байт соли файла + 4 байта индекса чанка.
 * @param {Uint8Array} salt - Соль файла (8 байт).
 * @param {number} index - Порядковый номер чанка.
 * @returns {Uint8Array} - Nonce из 12 байтов.
 */
export function createChunkNonce(salt: Uint8Array<ArrayBuffer>, index: number): Uint8Array<ArrayBuffer> {
    if (salt.length !== CHUNK_SALT_LENGTH) throw new Error("Соль чанка должна быть 8 байт");
    const nonce = new Uint8Array(NONCE_LENGTH);
    nonce.set(salt, 0);
    new DataView(nonce.buffer).setUint32(CHUNK_SALT_LENGTH, index >>> 0, false);
    return nonce;
}

// ===========================================================================
// AES-256-GCM
// ===========================================================================

/**
 * Сборка параметров AES-GCM с опциональными дополнительными данными (AAD).
 * @param {Uint8Array} nonce - Nonce из 12 байтов.
 * @param {Uint8Array} [aad] - Дополнительные данные (не шифруются, но
 *     аутентифицируются тегом).
 * @returns {AesGcmParams} - Параметры алгоритма.
 */
function aesGcmParams(nonce: Uint8Array<ArrayBuffer>, aad?: Uint8Array<ArrayBuffer>): AesGcmParams {
    const params: AesGcmParams = { name: "AES-GCM", iv: nonce };
    if (aad) params.additionalData = aad;
    return params;
}

/**
 * Импорт сырого ключа AES-256-GCM (например, vault-ключа из localStorage).
 * @param {Uint8Array} raw - Ключевые байты (32 байта).
 * @returns {Promise<CryptoKey>} - Ключ AES-256-GCM.
 */
export async function importAesKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    if (raw.length !== AES_KEY_LENGTH) throw new Error("Ключ AES-256 должен быть 32 байта");
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Шифрование блока данных: возвращает nonce || ciphertext.
 * @param {CryptoKey} key - Ключ AES-256-GCM.
 * @param {Uint8Array} nonce - Nonce из 12 байтов.
 * @param {Uint8Array} plaintext - Открытые данные.
 * @param {Uint8Array} [aad] - Дополнительные аутентифицируемые данные.
 * @returns {Promise<Uint8Array>} - Блок nonce || ciphertext.
 */
export async function encryptPayload(
    key: CryptoKey,
    nonce: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>,
    aad?: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const ciphertext = await crypto.subtle.encrypt(aesGcmParams(nonce, aad), key, plaintext);
    return concatBytes(nonce, new Uint8Array(ciphertext));
}

/**
 * Расшифровка блока данных вида nonce || ciphertext.
 * @param {CryptoKey} key - Ключ AES-256-GCM.
 * @param {Uint8Array} payload - Блок nonce || ciphertext.
 * @param {Uint8Array} [aad] - Дополнительные аутентифицируемые данные.
 * @returns {Promise<Uint8Array>} - Открытые данные.
 */
export async function decryptPayload(
    key: CryptoKey,
    payload: Uint8Array<ArrayBuffer>,
    aad?: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    if (payload.length <= NONCE_LENGTH) throw new Error("Зашифрованный блок короче nonce");
    const nonce = payload.subarray(0, NONCE_LENGTH);
    const ciphertext = payload.subarray(NONCE_LENGTH);
    const plaintext = await crypto.subtle.decrypt(aesGcmParams(nonce, aad), key, ciphertext);
    return new Uint8Array(plaintext);
}

// ===========================================================================
// ECDH (P-256) и HKDF
// ===========================================================================

/**
 * Генерация пары ключей ECDH.
 * @param {boolean} extractable - Экспортируемость приватного ключа (true —
 *     для долговременного identity-ключа, который сохраняется локально).
 * @returns {Promise<SecretKeyPair>} - Пара ключей.
 */
async function generateKeyPair(extractable: boolean): Promise<SecretKeyPair> {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: ECDH_CURVE }, extractable, ["deriveBits"]);
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
    return { privateKey: pair.privateKey, publicKey };
}

/**
 * Генерация долговременной пары ключей идентичности устройства (IK).
 * @returns {Promise<SecretKeyPair>} - Пара ключей (приватный экспортируем).
 */
export async function generateIdentityKeyPair(): Promise<SecretKeyPair> {
    return generateKeyPair(true);
}

/**
 * Генерация одноразовой эфемерной пары ключей (EK) для handshake.
 * @returns {Promise<SecretKeyPair>} - Пара ключей (приватный не экспортируется).
 */
export async function generateEphemeralKeyPair(): Promise<SecretKeyPair> {
    return generateKeyPair(false);
}

/**
 * Экспорт приватного ключа идентичности (PKCS8) для локального хранения.
 * @param {SecretKeyPair} keyPair - Пара ключей идентичности.
 * @returns {Promise<Uint8Array>} - Приватный ключ в PKCS8 (DER).
 */
export async function exportIdentityPrivateKey(keyPair: SecretKeyPair): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
}

/**
 * Импорт пары ключей идентичности из сохранённого приватного ключа.
 * Приватный ключ импортируется экспортируемым (как сгенерированный): identity
 * перепаковывается в vault-контейнер при handshake, и exportKey на
 * неэкспортируемом ключе падал DOMException.
 * @param {Uint8Array} privatePkcs8 - Приватный ключ в PKCS8 (DER).
 * @param {Uint8Array} publicSpki - Публичный ключ в SPKI (DER).
 * @returns {Promise<SecretKeyPair>} - Пара ключей.
 */
export async function importIdentityKeyPair(
    privatePkcs8: Uint8Array<ArrayBuffer>,
    publicSpki: Uint8Array<ArrayBuffer>,
): Promise<SecretKeyPair> {
    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privatePkcs8,
        { name: "ECDH", namedCurve: ECDH_CURVE },
        true,
        ["deriveBits"],
    );
    return { privateKey, publicKey: publicSpki };
}

/**
 * Импорт публичного ключа собеседника (SPKI).
 * @param {Uint8Array} publicSpki - Публичный ключ в SPKI (DER).
 * @returns {Promise<CryptoKey>} - Публичный ключ ECDH.
 */
export async function importPublicKey(publicSpki: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    return crypto.subtle.importKey("spki", publicSpki, { name: "ECDH", namedCurve: ECDH_CURVE }, false, []);
}

/**
 * Вычисление общего секрета ECDH (256 бит).
 * @param {CryptoKey} privateKey - Собственный приватный ключ.
 * @param {Uint8Array} publicSpki - Публичный ключ контрагента (SPKI).
 * @returns {Promise<Uint8Array>} - Общий секрет (32 байта).
 */
export async function deriveSharedSecret(
    privateKey: CryptoKey,
    publicSpki: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const publicKey = await importPublicKey(publicSpki);
    const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    return new Uint8Array(secret);
}

/**
 * Выведение ключа HKDF из общего секрета.
 * @param {Uint8Array} ikm - Исходный ключевой материал.
 * @param {Uint8Array} salt - Соль (id чата).
 * @param {string} info - Контекст выведения.
 * @param {number} bits - Длина результата в битах.
 * @returns {Promise<Uint8Array>} - Выведенные байты.
 */
async function deriveHkdfBits(
    ikm: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
    info: string,
    bits: number,
): Promise<Uint8Array<ArrayBuffer>> {
    const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    const infoBytes = new TextEncoder().encode(info);
    const derived = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: infoBytes }, baseKey, bits);
    return new Uint8Array(derived);
}

/**
 * Выведение ключа шифрования сообщений (AES-256-GCM) из общего секрета.
 * @param {Uint8Array} ikm - Исходный ключевой материал.
 * @param {Uint8Array} salt - Соль (id чата).
 * @param {string} info - Контекст выведения.
 * @returns {Promise<CryptoKey>} - Ключ AES-256-GCM.
 */
export async function deriveAesKey(
    ikm: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
    info: string,
): Promise<CryptoKey> {
    const raw = await deriveHkdfBits(ikm, salt, info, 256);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Выведение ключа HMAC-SHA-256 (подтверждение handshake) из общего секрета.
 * @param {Uint8Array} ikm - Исходный ключевой материал.
 * @param {Uint8Array} salt - Соль (id чата).
 * @param {string} info - Контекст выведения.
 * @returns {Promise<CryptoKey>} - Ключ HMAC-SHA-256.
 */
export async function deriveHmacKey(
    ikm: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
    info: string,
): Promise<CryptoKey> {
    const raw = await deriveHkdfBits(ikm, salt, info, 256);
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// ===========================================================================
// Хэши и HMAC
// ===========================================================================

/**
 * Хэш SHA-256 от данных.
 * @param {Uint8Array} data - Входные данные.
 * @returns {Promise<Uint8Array>} - Хэш (32 байта).
 */
export async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(digest);
}

/**
 * Подпись данных ключом HMAC-SHA-256.
 * @param {CryptoKey} macKey - Ключ HMAC.
 * @param {Uint8Array} data - Данные для подписи.
 * @returns {Promise<Uint8Array>} - Подпись (32 байта).
 */
export async function computeHmac(
    macKey: CryptoKey,
    data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const signature = await crypto.subtle.sign("HMAC", macKey, data);
    return new Uint8Array(signature);
}

/**
 * Проверка подписи HMAC с сравнением «в постоянное время».
 * @param {CryptoKey} macKey - Ключ HMAC.
 * @param {Uint8Array} data - Данные для подписи.
 * @param {Uint8Array} expected - Ожидаемая подпись.
 * @returns {Promise<boolean>} - true, если подпись верна.
 */
export async function verifyHmac(
    macKey: CryptoKey,
    data: Uint8Array<ArrayBuffer>,
    expected: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
    const signature = await computeHmac(macKey, data);
    return equalBytes(signature, expected);
}
