// Импортируем utils
import {
    compareBytes,
    computeHmac,
    concatBytes,
    deriveAesKey,
    deriveHmacKey,
    deriveSharedSecret,
    verifyHmac,
    type SecretKeyPair,
} from "./secret_crypto.js";

/**
 * Собственные ключи для handshake секретного чата.
 */
export interface HandshakeOwnKeys {
    /** Долговременная пара ключей идентичности устройства (IK). */
    identity: SecretKeyPair;
    /** Одноразовая эфемерная пара ключей (EK). */
    ephemeral: SecretKeyPair;
}

/**
 * Публичные ключи собеседника для handshake.
 */
export interface HandshakePeerKeys {
    /** Публичный ключ идентичности собеседника (SPKI). */
    identityPublic: Uint8Array<ArrayBuffer>;
    /** Эфемерный публичный ключ собеседника (SPKI). */
    ephemeralPublic: Uint8Array<ArrayBuffer>;
}

/**
 * Ключи сессии секретного чата (результат handshake).
 */
export interface SecretSessionKeys {
    /** Ключ шифрования сообщений (AES-256-GCM). */
    sessionKey: CryptoKey;
    /** Ключ подтверждения handshake (HMAC-SHA-256). */
    confirmKey: CryptoKey;
}

// Контекст выведения ключа шифрования сообщений (HKDF info)
const SESSION_KEY_INFO = "kodme/secret-chat/v1";

// Контекст выведения ключа подтверждения handshake (HKDF info)
const CONFIRM_KEY_INFO = "kodme/secret-chat/v1/confirm";

// Данные, подписываемые ключом подтверждения handshake
const CONFIRM_DATA = new TextEncoder().encode("confirm");

/**
 * Вычисление ключей сессии секретного чата (схема X3DH-lite).
 *
 * Общий секрет собирается из трёх ECDH-обменов:
 * Z1 = ECDH(IK_A, EK_B), Z2 = ECDH(EK_A, IK_B), Z3 = ECDH(EK_A, EK_B).
 * Порядок Z1/Z2 у сторон разный, поэтому он канонизируется сортировкой
 * публичных ключей идентичности — оба устройства получают один IKM.
 *
 * @param {HandshakeOwnKeys} own - Собственные ключи (identity + ephemeral).
 * @param {HandshakePeerKeys} peer - Публичные ключи собеседника.
 * @param {string} chatId - Id чата (используется как salt HKDF).
 * @returns {Promise<SecretSessionKeys>} - Ключи сессии.
 */
export async function deriveSessionKeys(
    own: HandshakeOwnKeys,
    peer: HandshakePeerKeys,
    chatId: string,
): Promise<SecretSessionKeys> {

    // Канонический порядок DH-частей определяется сортировкой ключей идентичности
    const order = compareBytes(own.identity.publicKey, peer.identityPublic);
    if (order === 0) throw new Error("Ключи идентичности совпадают: handshake невозможен");

    // Три ECDH-обмена, Z3 — эфемерный «на всякий случай» (ratchet-lite при rekey)
    const zOwnStatic = await deriveSharedSecret(own.identity.privateKey, peer.ephemeralPublic);
    const zPeerStatic = await deriveSharedSecret(own.ephemeral.privateKey, peer.identityPublic);
    const zEphemeral = await deriveSharedSecret(own.ephemeral.privateKey, peer.ephemeralPublic);

    // Сторона с меньшим ключом идентичности ставит свой Z1 первым
    const ikm = order < 0
        ? concatBytes(zOwnStatic, zPeerStatic, zEphemeral)
        : concatBytes(zPeerStatic, zOwnStatic, zEphemeral);

    const salt = new TextEncoder().encode(chatId);
    const sessionKey = await deriveAesKey(ikm, salt, SESSION_KEY_INFO);
    const confirmKey = await deriveHmacKey(ikm, salt, CONFIRM_KEY_INFO);
    return { sessionKey, confirmKey };

}

/**
 * Подтверждение handshake: HMAC от константы ключом подтверждения.
 * Совпадающие значения у сторон подтверждают, что обе вычислили один SK
 * (защита от подмены посредником на этапе обмена ключами).
 * @param {CryptoKey} confirmKey - Ключ подтверждения (HMAC-SHA-256).
 * @returns {Promise<Uint8Array>} - Подтверждение (32 байта).
 */
export async function computeConfirmation(confirmKey: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
    return computeHmac(confirmKey, CONFIRM_DATA);
}

/**
 * Проверка подтверждения handshake от собеседника.
 * @param {CryptoKey} confirmKey - Ключ подтверждения (HMAC-SHA-256).
 * @param {Uint8Array} received - Подтверждение, полученное от собеседника.
 * @returns {Promise<boolean>} - true, если подтверждение верно.
 */
export async function verifyConfirmation(
    confirmKey: CryptoKey,
    received: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
    return verifyHmac(confirmKey, CONFIRM_DATA, received);
}
