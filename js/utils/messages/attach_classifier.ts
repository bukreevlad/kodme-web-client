// Импортируем справочник типов файлов
import { isKind } from "../../config/file_types.js";

/**
 * ***************************************************************************
 * AttachClassifier - единая классификация вложений по типу контента.
 *
 * Зачем нужен модуль:
 * - проверки `isKind("image", mime)` были продублированы минимум в двух
 *   местах (`message_attaches.js`, `attachment_strip.js`), и со временем
 *   разъехались: в одном месте голосовое отличалось от обычного аудио по
 *   `metadata.flags.is_audio_note`, в другом — нет;
 * - различение «голосовое/видео-кружок» повторялось минимум дважды, хотя
 *   это свойство метадаты, а не mime-типа;
 * - локальные (temp) вложения приходят с полем `type`, серверные — с `mime_type`.
 *
 * Модуль чистый: никакого DOM, только разбор объекта вложения.
 * ***************************************************************************
 */

/**
 * Метадата вложения (канонические флаги заметок лежат в `flags`).
 */
interface AttachmentMetadata {
    /** Канонические флаги заметок (контракт v2) — единственный источник правды. */
    flags?: {
        /** Голосовое сообщение. */
        is_audio_note?: boolean;
        /** Видео-кружок. */
        is_video_note?: boolean;
        [key: string]: unknown;
    };
    /** Данные волны голосового. */
    wave_form?: unknown;
    /** Признак непройденной обработки: производные ассеты не созданы. */
    processed?: boolean;
    [key: string]: unknown;
}

/**
 * Вложение (серверное `mime_type` либо локальное `type` + метадата).
 */
interface AttachmentLike {
    /** MIME-тип (сервер). */
    mime_type?: string;
    /** MIME-тип (локальный File). */
    type?: string;
    /** Метадата вложения. */
    metadata?: AttachmentMetadata;
    [key: string]: unknown;
}

/**
 * ***************************************************************************
 * Типы вложений.
 * ***************************************************************************
 */
export const ATTACH_TYPES = Object.freeze({
    IMAGE: "image",
    AUDIO: "audio",
    AUDIO_NOTE: "audio-note",
    VIDEO: "video",
    VIDEO_NOTE: "video-note",
    DOCUMENT: "document"
});

/**
 * ***************************************************************************
 * Достать MIME-тип вложения независимо от источника.
 *
 * Сервер отдаёт `mime_type`, локальный File приходит как `type`.
 * @param {AttachmentLike} [attachment] - Вложение.
 * @returns {string} - MIME-тип в нижнем регистре или пустая строка.
 * ***************************************************************************
 */
export function getMimeType(attachment?: AttachmentLike): string {

    const mime = attachment?.mime_type || attachment?.type || "";

    return String(mime).toLowerCase().trim();

}

/**
 * ***************************************************************************
 * Определить тип вложения.
 * @param {AttachmentLike} [attachment] - Вложение ({ mime_type|type, metadata }).
 * @returns {string} - Одно из значений ATTACH_TYPES.
 * ***************************************************************************
 */
export function classify(attachment?: AttachmentLike): string {

    // Вложения нет — считаем документом: потребители уже отфильтровали мусор
    if (!attachment) return ATTACH_TYPES.DOCUMENT;

    // Деградация обработки: оригинал загружен, но
    // производные ассеты не созданы — конвейер отработал неудачно либо
    // обработка выключена конфигом. Такое вложение показываем документом
    // для скачивания, не полагаясь на mime: превью, плееры и осциллограмма
    // без производных сломаны
    if (attachment.metadata?.processed === false) return ATTACH_TYPES.DOCUMENT;

    const mime = getMimeType(attachment);

    // Голосовое и видео-кружок определяются метадатой, а не mime:
    // файл обычный (.m4a/.mp4), отличается только способ записи.
    // Канонический и единственный флаг — в metadata.flags (контракт v2)
    if (_noteFlag(attachment.metadata, "is_audio_note")) return ATTACH_TYPES.AUDIO_NOTE;
    if (_noteFlag(attachment.metadata, "is_video_note")) return ATTACH_TYPES.VIDEO_NOTE;

    // Дальше смотрим только на mime-тип
    if (isKind("image", mime)) return ATTACH_TYPES.IMAGE;
    if (isKind("audio", mime)) return ATTACH_TYPES.AUDIO;
    if (isKind("video", mime)) return ATTACH_TYPES.VIDEO;

    // Всё остальное — документ
    return ATTACH_TYPES.DOCUMENT;

}

/**
 * ***************************************************************************
 * Прочитать флаг вложения-заметки.
 *
 * Флаг живёт ТОЛЬКО в `metadata.flags` (контракт v2) — корневое дублирование
 * `is_audio_note`/`is_video_note` удалено, отдельного фолбэка нет.
 *
 * @param {AttachmentMetadata} [metadata] - Метадата вложения.
 * @param {"is_audio_note" | "is_video_note"} key - Ключ флага.
 * @returns {boolean} - true, если флаг выставлен.
 * ***************************************************************************
 */
function _noteFlag(metadata: AttachmentMetadata | undefined, key: "is_audio_note" | "is_video_note"): boolean {

    return metadata?.flags?.[key] === true;

}

/**
 * ***************************************************************************
 * Проверить, является ли вложение голосовым сообщением.
 *
 * Голосовое должно быть «полноценным»: с метадатой волны. Иначе при
 * загрузке голосового (метадата ещё не готова) оно рендерилось обычным
 * плеером, а потом прыгало в кружок — визуальный баг.
 * @param {AttachmentLike} [attachment] - Вложение.
 * @returns {boolean} - true, если это голосовое сообщение.
 * ***************************************************************************
 */
export function isAudioNote(attachment?: AttachmentLike): boolean {

    return classify(attachment) === ATTACH_TYPES.AUDIO_NOTE
        && Boolean(attachment?.metadata?.wave_form);

}

/**
 * ***************************************************************************
 * Проверить, является ли вложение видео-кружком.
 * @param {AttachmentLike} [attachment] - Вложение.
 * @returns {boolean} - true, если это видео-кружок.
 * ***************************************************************************
 */
export function isVideoNote(attachment?: AttachmentLike): boolean {

    return classify(attachment) === ATTACH_TYPES.VIDEO_NOTE;

}

/**
 * ***************************************************************************
 * Отфильтровать вложения по типу.
 * @param {AttachmentLike[]} [attachments] - Массив вложений (уже нормализованный).
 * @param {string} type - Значение ATTACH_TYPES.
 * @returns {AttachmentLike[]} - Подходящие вложения.
 * ***************************************************************************
 */
export function filterByType(attachments: AttachmentLike[] | null | undefined, type: string): AttachmentLike[] {

    return (attachments || []).filter(attachment => classify(attachment) === type);

}
