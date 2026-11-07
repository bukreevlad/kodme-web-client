// Импортируем bun test
import { describe, expect, test } from "bun:test";

// Импортируем utils
import { genUuidv7 } from "../js/utils/crypto/gen_uuidv7.js";
import { importAesKey, randomBytes } from "../js/utils/crypto/secret_crypto.js";
import {
    bytesToUuid,
    decodeFrame,
    encodeControlFrame,
    encodeFileChunkFrame,
    FrameAssembler,
    MAX_FRAME_SIZE,
    parseMessagePayload,
    parseSecretControlMessage,
    splitFrame,
    uuidToBytes,
    type SecretControlMessage,
} from "../js/utils/secret_chats/secret_frames.js";

/**
 * Ключ сессии для тестов кадров.
 */
async function testSessionKey(): Promise<CryptoKey> {
    return importAesKey(randomBytes(32));
}

/**
 * ***************************************************************************
 * Секретные чаты: протокол кадров DataChannel и UUIDv7.
 * ***************************************************************************
 */
describe("секретные чаты: протокол кадров", () => {

    /**
     * ***************************************************************************
     * Control-кадр: шифрование/дешифрование без потерь.
     * ***************************************************************************
     */
    test("control-кадр: round-trip", async () => {
        const key = await testSessionKey();
        const control: SecretControlMessage = {
            type: "msg",
            message_id: genUuidv7(),
            msg_type: "text",
            payload: { text: "привет", file_id: null, files: null, reply_to: null, duration: null, created_at: 12345 },
        };

        const frame = await encodeControlFrame(key, "chat-1", 0, control);
        const decoded = await decodeFrame(key, "chat-1", frame);
        expect(decoded.kind).toBe("control");
        if (decoded.kind !== "control") throw new Error("Ожидался control-кадр");
        expect(decoded.control).toEqual(control);
    });

    /**
     * ***************************************************************************
     * Порча кадра и чужой chatId (AAD) ломают расшифровку.
     * ***************************************************************************
     */
    test("control-кадр: порча и чужой AAD не проходят", async () => {
        const key = await testSessionKey();
        const frame = await encodeControlFrame(key, "chat-1", 1, { type: "ping" });

        // Портим последний байт шифротекста
        const tampered = new Uint8Array(frame);
        tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
        await expect(decodeFrame(key, "chat-1", tampered)).rejects.toThrow();

        // Чужой чат (AAD) не проходит аутентификацию
        await expect(decodeFrame(key, "chat-2", frame)).rejects.toThrow();
    });

    /**
     * ***************************************************************************
     * Кадр чанка файла: round-trip с id и индексом.
     * ***************************************************************************
     */
    test("кадр чанка файла: round-trip", async () => {
        const key = await testSessionKey();
        const fileId = genUuidv7();
        const data = new TextEncoder().encode("данные чанка");

        const frame = await encodeFileChunkFrame(key, "chat-1", fileId, 7, data);
        const decoded = await decodeFrame(key, "chat-1", frame);
        expect(decoded.kind).toBe("file_chunk");
        if (decoded.kind !== "file_chunk") throw new Error("Ожидался кадр чанка");
        expect(decoded.fileId).toBe(fileId);
        expect(decoded.index).toBe(7);
        expect(decoded.data).toEqual(data);
    });

    /**
     * ***************************************************************************
     * UUID ↔ байты: round-trip и отклонение мусора.
     * ***************************************************************************
     */
    test("uuid ↔ байты: round-trip и валидация", () => {
        const uuid = genUuidv7();
        expect(bytesToUuid(uuidToBytes(uuid))).toBe(uuid);
        expect(() => uuidToBytes("не-uuid")).toThrow();
        expect(() => bytesToUuid(new Uint8Array(5))).toThrow();
    });

    /**
     * ***************************************************************************
     * UUIDv7: формат, версия и уникальность.
     * ***************************************************************************
     */
    test("genUuidv7: формат и версия", () => {
        const first = genUuidv7();
        const second = genUuidv7();
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(first).not.toBe(second);
    });

    /**
     * ***************************************************************************
     * Разбор control-сообщений: валидные проходят, мусор отклоняется.
     * ***************************************************************************
     */
    test("разбор control-сообщений: валидация", () => {

        // Валидное сообщение проходит
        const parsed = parseSecretControlMessage({
            type: "receipt",
            message_ids: ["id-1", "id-2"],
            status: "read",
        });
        expect(parsed).toEqual({ type: "receipt", message_ids: ["id-1", "id-2"], status: "read" });

        // Неизвестный тип и битые поля отклоняются
        expect(() => parseSecretControlMessage({ type: "hack" })).toThrow();
        expect(() => parseSecretControlMessage({ type: "msg", message_id: 1, msg_type: "text", payload: {} })).toThrow();
        expect(() => parseSecretControlMessage({ type: "msg", message_id: "id", msg_type: "unknown", payload: {} })).toThrow();
        expect(() => parseSecretControlMessage({ type: "receipt", message_ids: "id", status: "read" })).toThrow();
        expect(() => parseSecretControlMessage(null)).toThrow();

        // Payload сообщения: обязательное created_at
        const payload = parseMessagePayload({ text: "x", created_at: 100 });
        expect(payload.text).toBe("x");
        expect(payload.file_id).toBeNull();
        expect(payload.files).toBeNull();
        expect(() => parseMessagePayload({ text: "x" })).toThrow();

        // Payload с вложениями: метаданные и миниатюры (впереди оригиналов)
        const withFiles = parseMessagePayload({
            text: null,
            created_at: 100,
            files: [{
                file_id: "f-1",
                name: "a.jpg",
                mime_type: "image/jpeg",
                size: 123,
                duration: null,
                width: 100,
                height: 50,
                thumbnail: "data:image/webp;base64,AAAA",
                placeholder: "data:image/webp;base64,BBBB",
                wave_form: [0.1, 0.9, 0.5],
                flags: { is_audio_note: true, is_video_note: false, junk: 1 },
            }],
        });
        expect(withFiles.files).toHaveLength(1);
        const ref = withFiles.files?.[0];
        expect(ref?.file_id).toBe("f-1");
        expect(ref?.thumbnail).toBe("data:image/webp;base64,AAAA");
        expect(ref?.wave_form).toEqual([0.1, 0.9, 0.5]);
        expect(ref?.flags).toEqual({ is_audio_note: true });

        // Битые метаданные вложения отклоняются
        expect(() => parseMessagePayload({ text: "x", created_at: 1, files: [{ name: "a" }] })).toThrow();
        expect(() => parseMessagePayload({ text: "x", created_at: 1, files: "nope" })).toThrow();
    });

    /**
     * ***************************************************************************
     * Дробление кадров под лимит сообщения канала: кадр крупнее лимита уходит
     * частями и собирается обратно без потерь.
     * ***************************************************************************
     */
    test("дробление кадров: round-trip через FrameAssembler", () => {

        // Кадр крупнее лимита дробится, каждая часть вписывается в лимит
        const source = randomBytes(200 * 1024);
        const parts = splitFrame(source);
        expect(parts.length).toBeGreaterThan(1);
        for (const part of parts) {
            expect(part.length).toBeLessThanOrEqual(MAX_FRAME_SIZE);
        }

        // Сборщик возвращает исходный кадр
        const assembler = new FrameAssembler();
        let assembled: Uint8Array<ArrayBuffer> | null = null;
        for (const part of parts) {
            const result = assembler.push(part);
            if (result) assembled = result;
        }
        expect(assembled).toEqual(source);
    });

    /**
     * ***************************************************************************
     * Кадр в лимите канала уходит одним куском, а кадр чанка файла в полном
     * размере чанка передачи вписывается в лимит сообщения канала.
     * ***************************************************************************
     */
    test("дробление кадров: кадр в лимите не дробится", async () => {
        const key = await testSessionKey();
        const frame = await encodeControlFrame(key, "chat-1", 2, { type: "ping" });
        expect(splitFrame(frame)).toEqual([frame]);

        // Кадр чанка файла: полный чанк передачи уходит одним сообщением канала
        const chunkFrame = await encodeFileChunkFrame(key, "chat-1", genUuidv7(), 0, randomBytes(64 * 1024 - 128));
        expect(chunkFrame.length).toBeLessThanOrEqual(MAX_FRAME_SIZE);
    });

});
