// Импортируем bun test
import { describe, expect, test } from "bun:test";

// Импортируем utils
import {
    createChunkNonce,
    createChunkSalt,
    createMessageNonce,
    decryptPayload,
    encryptPayload,
    generateEphemeralKeyPair,
    generateIdentityKeyPair,
    importAesKey,
    randomBytes,
    readMessageNonceCounter,
} from "../js/utils/crypto/secret_crypto.js";
import {
    computeConfirmation,
    deriveSessionKeys,
    verifyConfirmation,
} from "../js/utils/crypto/secret_handshake.js";
import {
    computeFingerprint,
    createVerificationPayload,
    fingerprintToEmoji,
    fingerprintToHex,
    parseVerificationPayload,
} from "../js/utils/crypto/fingerprint.js";
import {
    decryptFileChunk,
    decryptJsonValue,
    encryptFileChunk,
    encryptJsonValue,
} from "../js/utils/crypto/vault.js";

/**
 * Сборка собственных и чужих ключей handshake двух «устройств».
 */
async function createHandshakeKeys() {
    const identityA = await generateIdentityKeyPair();
    const identityB = await generateIdentityKeyPair();
    const ephemeralA = await generateEphemeralKeyPair();
    const ephemeralB = await generateEphemeralKeyPair();
    const sessionA = await deriveSessionKeys(
        { identity: identityA, ephemeral: ephemeralA },
        { identityPublic: identityB.publicKey, ephemeralPublic: ephemeralB.publicKey },
        "chat-1",
    );
    const sessionB = await deriveSessionKeys(
        { identity: identityB, ephemeral: ephemeralB },
        { identityPublic: identityA.publicKey, ephemeralPublic: ephemeralA.publicKey },
        "chat-1",
    );
    return { identityA, identityB, ephemeralA, ephemeralB, sessionA, sessionB };
}

/**
 * ***************************************************************************
 * Секретные чаты: криптография (handshake, шифрование, отпечаток, vault).
 * ***************************************************************************
 */
describe("секретные чаты: криптография", () => {

    /**
     * ***************************************************************************
     * Handshake симметричен: оба устройства выводят одинаковый ключ сессии.
     * ***************************************************************************
     */
    test("handshake выводит одинаковые ключи на обоих устройствах", async () => {
        const { sessionA, sessionB } = await createHandshakeKeys();

        // Совпадающие подтверждения доказывают совпадение ключей (они не экспортируемы)
        const confirmA = await computeConfirmation(sessionA.confirmKey);
        const confirmB = await computeConfirmation(sessionB.confirmKey);
        expect(confirmA).toEqual(confirmB);

        // Ключ шифрования тоже одинаковый: шифруем на A, расшифровываем на B
        const aad = new TextEncoder().encode("chat-1");
        const plaintext = new TextEncoder().encode("секретное сообщение");
        const payload = await encryptPayload(sessionA.sessionKey, createMessageNonce(1), plaintext, aad);
        const decrypted = await decryptPayload(sessionB.sessionKey, payload, aad);
        expect(new TextDecoder().decode(decrypted)).toBe("секретное сообщение");
    });

    /**
     * ***************************************************************************
     * Ключи зависят от id чата: другой чат — другой сессионный ключ.
     * ***************************************************************************
     */
    test("id чата влияет на сессионный ключ", async () => {
        const identityA = await generateIdentityKeyPair();
        const identityB = await generateIdentityKeyPair();
        const ephemeralA = await generateEphemeralKeyPair();
        const ephemeralB = await generateEphemeralKeyPair();

        const first = await deriveSessionKeys(
            { identity: identityA, ephemeral: ephemeralA },
            { identityPublic: identityB.publicKey, ephemeralPublic: ephemeralB.publicKey },
            "chat-1",
        );
        const second = await deriveSessionKeys(
            { identity: identityA, ephemeral: ephemeralA },
            { identityPublic: identityB.publicKey, ephemeralPublic: ephemeralB.publicKey },
            "chat-2",
        );

        const confirmFirst = await computeConfirmation(first.confirmKey);
        const confirmSecond = await computeConfirmation(second.confirmKey);
        expect(confirmFirst).not.toEqual(confirmSecond);
    });

    /**
     * ***************************************************************************
     * Подтверждение handshake: верное подтверждается, чужое отклоняется.
     * ***************************************************************************
     */
    test("подтверждение handshake проверяется", async () => {
        const { sessionA, sessionB } = await createHandshakeKeys();
        const confirmA = await computeConfirmation(sessionA.confirmKey);
        expect(await verifyConfirmation(sessionB.confirmKey, confirmA)).toBe(true);
        expect(await verifyConfirmation(sessionB.confirmKey, randomBytes(32))).toBe(false);
    });

    /**
     * ***************************************************************************
     * Шифрование payload: порча блока или чужой AAD ломают расшифровку.
     * ***************************************************************************
     */
    test("payload: расшифровка падает при порче и при чужом AAD", async () => {
        const key = await importAesKey(randomBytes(32));
        const aad = new TextEncoder().encode("msg-1");
        const plaintext = new TextEncoder().encode("текст");

        const payload = await encryptPayload(key, createMessageNonce(1), plaintext, aad);
        expect(new TextDecoder().decode(await decryptPayload(key, payload, aad))).toBe("текст");

        // Портим последний байт шифротекста
        const tampered = new Uint8Array(payload);
        tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
        await expect(decryptPayload(key, tampered, aad)).rejects.toThrow();

        // Чужие дополнительные данные не проходят аутентификацию
        await expect(decryptPayload(key, payload, new TextEncoder().encode("msg-2"))).rejects.toThrow();
    });

    /**
     * ***************************************************************************
     * Nonce сообщения несёт счётчик (контроль повторов на приёме).
     * ***************************************************************************
     */
    test("nonce сообщения сохраняет счётчик", async () => {
        const key = await importAesKey(randomBytes(32));
        const payload = await encryptPayload(key, createMessageNonce(42), new TextEncoder().encode("x"));
        expect(readMessageNonceCounter(payload)).toBe(42);
    });

    /**
     * ***************************************************************************
     * Чанки файла: шифрование/расшифровка по соли и индексу, ошибки параметров.
     * ***************************************************************************
     */
    test("чанки файла: round-trip и защита от неверных параметров", async () => {
        const key = await importAesKey(randomBytes(32));
        const salt = createChunkSalt();

        const chunks = [
            new TextEncoder().encode("часть-1"),
            new TextEncoder().encode("часть-2"),
            new TextEncoder().encode("часть-3"),
        ];

        // Склеиваем обратно в исходный файл
        const decrypted: number[] = [];
        for (let index = 0; index < chunks.length; index++) {
            const data = chunks[index];
            if (!data) throw new Error("Чанк не найден");
            const payload = await encryptFileChunk(key, salt, index, data);
            const plain = await decryptFileChunk(key, salt, index, payload);
            decrypted.push(...plain);
        }
        expect(new Uint8Array(decrypted)).toEqual(new Uint8Array([
            ...new TextEncoder().encode("часть-1"),
            ...new TextEncoder().encode("часть-2"),
            ...new TextEncoder().encode("часть-3"),
        ]));

        // Неверный индекс чанка и чужая соль не расшифровываются
        const payload = await encryptFileChunk(key, salt, 0, new Uint8Array([1, 2, 3]));
        await expect(decryptFileChunk(key, salt, 1, payload)).rejects.toThrow();
        await expect(decryptFileChunk(key, createChunkSalt(), 0, payload)).rejects.toThrow();

        // Соль нестандартной длины отклоняется
        expect(() => createChunkNonce(new Uint8Array(3), 0)).toThrow();
    });

    /**
     * ***************************************************************************
     * Vault: JSON-значение шифруется и расшифровывается без потерь.
     * ***************************************************************************
     */
    test("vault: JSON round-trip", async () => {
        const key = await importAesKey(randomBytes(32));
        const value = { text: "привет", n: 7, list: [1, 2, 3] };
        const payload = await encryptJsonValue(key, value);
        expect(await decryptJsonValue(key, payload)).toEqual(value);
    });

    /**
     * ***************************************************************************
     * Отпечаток: симметричен, отображается в 4 эмодзи и hex.
     * ***************************************************************************
     */
    test("отпечаток: симметричность и отображение", async () => {
        const identityA = await generateIdentityKeyPair();
        const identityB = await generateIdentityKeyPair();

        const fingerprint = await computeFingerprint(identityA.publicKey, identityB.publicKey);
        const reversed = await computeFingerprint(identityB.publicKey, identityA.publicKey);
        expect(fingerprint).toEqual(reversed);

        expect(fingerprintToEmoji(fingerprint)).toHaveLength(4);
        expect(fingerprintToHex(fingerprint)).toHaveLength(64);

        // У другой пары ключей отпечаток другой
        const identityC = await generateIdentityKeyPair();
        const other = await computeFingerprint(identityA.publicKey, identityC.publicKey);
        expect(other).not.toEqual(fingerprint);
    });

    /**
     * ***************************************************************************
     * QR-код верификации: payload создается и разбирается без потерь.
     * ***************************************************************************
     */
    test("QR-код верификации: round-trip payload", async () => {
        const identityA = await generateIdentityKeyPair();
        const identityB = await generateIdentityKeyPair();
        const fingerprint = await computeFingerprint(identityA.publicKey, identityB.publicKey);

        const payload = createVerificationPayload(fingerprint, identityA.publicKey);
        const parsed = parseVerificationPayload(payload);
        expect(parsed.version).toBe(1);
        expect(parsed.fingerprint).toBeTruthy();
        expect(parsed.identity).toBeTruthy();

        // Мусор вместо payload отклоняется
        expect(() => parseVerificationPayload("не-base64url-json")).toThrow();
    });

});
