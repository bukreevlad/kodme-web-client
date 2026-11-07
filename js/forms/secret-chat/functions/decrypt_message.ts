// Импортируем utils
import { Vault } from "../../../utils/crypto/vault.js";
import { parseMessagePayload } from "../../../utils/secret_chats/secret_frames.js";
import { secretMessagesTable, secretFilesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем functions
import { buildAttachmentsFromPayload } from "./build_attaches.js";

// Импортируем типы
import type { SecretFileRecord, SecretMessageRecord } from "../../../types/secret_chats.js";
import type { SecretChatMessageRecord } from "../types.js";
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * decryptSecretMessage - расшифровка записи сообщения секретного чата
 * (vault-шифротекст payload) в запись Store формы.
 * @param record - Запись из IndexedDB.
 * @returns Расшифрованная запись для Store/DOM.
 * ***************************************************************************
 */
export async function decryptSecretMessage(record: SecretMessageRecord): Promise<SecretChatMessageRecord> {

    // Расшифровываем payload (Vault обязан быть инициализирован вместе с home)
    const payload = parseMessagePayload(await Vault.decryptJson(record.ciphertext));

    // Собираем запись Store: поля записи + расшифрованный payload.
    // Время создания приводим к ISO — его читают рендер строки и разделители дат
    return {
        ...record,
        text: payload.text,
        files: payload.files,
        attachments: buildAttachmentsFromPayload(payload),
        reply_to: payload.reply_to,
        file_id: payload.file_id,
        duration: payload.duration,
        created_at: new Date(payload.created_at).toISOString()
    };

}

/**
 * ***************************************************************************
 * decryptSecretFile - расшифровка файла из локального шифрованного хранения
 * (чанки vault-шифротекстом) в исходный Blob.
 * @param record - Запись файла из IndexedDB.
 * @returns Расшифрованный файл.
 * ***************************************************************************
 */
export async function decryptSecretFile(record: SecretFileRecord): Promise<Blob> {

    const parts: Blob[] = [];
    for (let index = 0; index < record.chunks.length; index++) {
        const chunk = record.chunks[index];
        if (!chunk) continue;
        const data = new Uint8Array(await chunk.arrayBuffer());
        parts.push(new Blob([await Vault.decryptChunk(record.chunk_salt, index, data)]));
    }

    return new Blob(parts, { type: record.mime_type });

}

/**
 * ***************************************************************************
 * loadSecretFile - чтение и расшифровка файла по id.
 * @param fileId - Id файла.
 * @returns Расшифрованный файл с записью либо null (файла нет).
 * ***************************************************************************
 */
export async function loadSecretFile(fileId: string): Promise<{ record: SecretFileRecord; blob: Blob } | null> {

    const record = await secretFilesTable().get(fileId);
    if (!record) return null;
    return { record, blob: await decryptSecretFile(record) };

}

/**
 * ***************************************************************************
 * withResolvedReply - дополняет запись данными сообщения-ответа для отрисовки
 * цитаты. Оригинал берётся из окна (Store), при промахе — из IndexedDB.
 * @param form - Экземпляр формы.
 * @param record - Расшифрованная запись.
 * @returns Запись с заполненным reply_to_message (или без него, если оригинал
 * недоступен — компонент покажет заглушку).
 * ***************************************************************************
 */
export async function withResolvedReply(form: SecretChat, record: SecretChatMessageRecord): Promise<SecretChatMessageRecord> {

    // Без ссылки на оригинал разрешать нечего
    if (!record.reply_to) return record;

    // Сначала ищем в текущем окне чата
    const fromStore = form.store.get(record.reply_to);
    if (fromStore) {
        return { ...record, reply_to_message: fromStore };
    }

    // Промах — берём из локальной истории (могло выпасть из окна)
    const original = await secretMessagesTable().get(record.reply_to);
    if (!original) return record;

    // Расшифровываем только текст цитаты (без вложенной цепочки ответов)
    const decrypted = await decryptSecretMessage(original);
    return {
        ...record,
        reply_to_message: { ...decrypted, reply_to: null, reply_to_message: null }
    };

}
