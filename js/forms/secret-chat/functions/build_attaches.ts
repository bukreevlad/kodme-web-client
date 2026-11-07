// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MediaOriginal } from "../../../types/media.js";
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { AttachmentMetadata } from "../../messages/components/types.js";
import type { SecretFileRef, SecretMessagePayload } from "../../../utils/secret_chats/secret_frames.js";

/** Объект-мап вложений сообщения (тот же тип, что хранит запись Store). */
type SecretAttachmentsMap = Extract<AttachmentsRaw, Record<string, unknown>>;

/**
 * ***************************************************************************
 * dataUriToBlob - разбор data-URI в Blob (миниатюры из payload сообщения).
 * @param {string} dataUri - Data-URI (image/webp;base64,...).
 * @returns {Blob | null} - Blob либо null (битый data-URI).
 * ***************************************************************************
 */
export function dataUriToBlob(dataUri: string): Blob | null {

    try {

        const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUri);
        if (!match) return null;

        const mime = match[1] || "application/octet-stream";
        const isBase64 = Boolean(match[2]);
        const body = match[3] ?? "";

        const bytes = isBase64
            ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
            : new TextEncoder().encode(decodeURIComponent(body));

        return new Blob([bytes], { type: mime });

    } catch (error) {
        Logger.debug("[app][secret-chat][build-attaches]: не удалось разобрать data-URI.", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * blobToDataUri - конвертация Blob в data-URI (миниатюра уходит в payload).
 * @param {Blob} blob - Данные файла.
 * @returns {Promise<string>} - Data-URI.
 * ***************************************************************************
 */
export function blobToDataUri(blob: Blob): Promise<string> {

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

}

/**
 * ***************************************************************************
 * buildAttachment - сборка вложения сообщения из метаданных payload.
 *
 * Результат совместим с фабриками вложений forms/messages (AttachParent):
 * превью рендерится из thumbnails (data-URI → Blob), оригинал подставляется
 * `_file`, когда файл уже доступен (отправитель/принятый файл).
 * @param {SecretFileRef} ref - Метаданные вложения из payload.
 * @param {Blob | null} [original] - Расшифрованный оригинал файла.
 * @returns {SecretAttachmentsMap[string]} - Вложение для рендера.
 * ***************************************************************************
 */
export function buildAttachment(ref: SecretFileRef, original?: Blob | null): SecretAttachmentsMap[string] {

    // Миниатюра (data-URI → Blob): фабрики рендерят превью из thumbnails
    // с _file/_url — как у локальных файлов обычных сообщений
    const thumbnail = ref.thumbnail ? dataUriToBlob(ref.thumbnail) : null;

    const originalMeta: MediaOriginal = {
        mime: ref.mime_type,
        size: ref.size
    };
    if (ref.width != null) originalMeta.width = ref.width;
    if (ref.height != null) originalMeta.height = ref.height;
    if (ref.duration != null) originalMeta.duration = ref.duration;

    const metadata: AttachmentMetadata = { original: originalMeta };
    if (ref.placeholder) metadata.placeholder = ref.placeholder;
    if (ref.wave_form) metadata.wave_form = ref.wave_form;
    if (ref.flags) metadata.flags = ref.flags;

    // Превью: data-URI из payload превращаем в локальную миниатюру (_file/_url)
    if (thumbnail && ref.thumbnail) {
        metadata.thumbnails = [{ width: ref.thumbnail_width ?? 400, _file: thumbnail, _url: ref.thumbnail }];
    }

    const attach: SecretAttachmentsMap[string] = {
        id: ref.file_id,
        name: ref.name,
        file_name: ref.name,
        mime_type: ref.mime_type,
        size: ref.size,
        metadata: metadata
    };

    // Оригинал подставляем, когда файл уже доступен локально
    if (original) attach._file = original;

    return attach;

}

/**
 * ***************************************************************************
 * buildAttachmentsFromPayload - сборка объекта-мапа вложений сообщения из
 * payload (несколько файлов) с опциональными оригиналами файлов.
 * @param {SecretMessagePayload} payload - Расшифрованный payload сообщения.
 * @param {Map<string, Blob>} [originals] - Расшифрованные оригиналы по file_id.
 * @returns {AttachmentsRaw} - Объект-мап вложений (для фабрик messages).
 * ***************************************************************************
 */
export function buildAttachmentsFromPayload(payload: SecretMessagePayload, originals?: Map<string, Blob>): AttachmentsRaw {

    const map: SecretAttachmentsMap = {};

    for (const ref of payload.files ?? []) {
        map[ref.file_id] = buildAttachment(ref, originals?.get(ref.file_id));
    }

    return map;

}
