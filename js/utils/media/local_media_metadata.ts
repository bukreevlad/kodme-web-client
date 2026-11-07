// Импортируем utils
import { processMedia } from "./media_processor.js";
import { Logger } from "../logs/logger.js";

// Импортируем типы
import type {
    MediaInput,
    MediaMetadata,
    MediaBlobItem,
    ProcessMediaResult,
    ProcessMediaOptions
} from "../../types/media.js";

/**
 * ***************************************************************************
 * buildLocalMediaMetadata - метадата локального вложения для интерфейса.
 *
 * Вся обработка (превью, цвета, длительность, теги) живёт в media_processor —
 * единой точке вбора. Здесь остаётся только адаптация результата под
 * локальный показ: контракт v2 несёт лишь width/size и не содержит Blob'ов,
 * а компонентам вложений нужны сам Blob (`_file`) и blob:-ссылка (`_url`)
 * ещё не загруженного превью.
 *
 * Осциллограмма считается только для голосовых заметок. Функция никогда не
 * бросает исключения: в худшем вернётся каркас.
 *
 * @param {MediaInput} file - Файл вложения.
 * @param {ProcessMediaOptions} [options] - Опции (пробрасываются в processMedia).
 * @returns {Promise<MediaMetadata>} - Метадата в формате компонентов.
 * ***************************************************************************
 */
export async function buildLocalMediaMetadata(file: MediaInput, options: ProcessMediaOptions = {}): Promise<MediaMetadata> {

    // Без файла отдаём пустой каркас, чтобы вызывающий код не проверял null
    if (!file) return _emptyDisplayMetadata();

    // Осциллограмму считаем только голосовым заметкам (см. выше). Явно
    // переданный caller'ом waveForm уважаем.
    const processOptions: ProcessMediaOptions = { ...options };
    if (processOptions.waveForm === undefined) {
        processOptions.waveForm = options?.extra?.is_audio_note === true;
    }

    // Рендерации видео локальному показу не нужны. Их кодирование — самая
    // тяжёлая часть обработки. Отправка сообщения строит их сама.
    processOptions.withRenditions = false;

    Logger.debug(`[media] local: старт для "${file?.name || "?"}", kind=${processOptions.kind || "auto"}`);

    const processed = await processMedia(file, processOptions);

    Logger.debug(
        `[media] local: готово для "${file?.name || "?"}", превью=${processed?.metadata?.thumbnails?.length ?? 0}`
    );

    // file.metadata — самый слабый источник (обычно его нет), результат
    // обработки его всегда перекрывает
    return {
        ...(file.metadata || {}),
        ..._toDisplayMetadata(processed)
    };

}

/**
 * ***************************************************************************
 * Адаптировать метадату контракта v2 под локальный показ.
 *
 * @param {ProcessMediaResult} processed - Результат processMedia.
 * @returns {MediaMetadata} - Метадата с локальными превью.
 * ***************************************************************************
 */
function _toDisplayMetadata(processed: ProcessMediaResult): MediaMetadata {

    const metadata = processed?.metadata || {};
    const blobs = processed?.blobs || [];

    // Достраиваем миниатюры: контракт v2 несёт только width/size, а локальному
    // показу нужны Blob (_file) и blob:-ссылка (_url)
    const thumbnails = (metadata.thumbnails || []).map((thumb) => {

        const blob = _findThumbnailBlob(blobs, thumb.width);

        return {
            width: thumb.width,
            size: thumb.size,
            height: blob?.height || 0,
            mime_type: "image/webp",
            _file: blob?.blob || null,
            _url: blob?.blob ? URL.createObjectURL(blob.blob) : null
        };

    });

    // Совместимость со старым контрактом: плеер видео читает hls/qualities,
    // их в v2 нет. Флаги заметок остаются ТОЛЬКО в metadata.flags — корневое
    // дублирование (и спред extra) удалено, читатели смотрят в flags
    return {
        ...metadata,
        original: {
            ...(metadata.original || {}),
            // Локальные компоненты ждут числа, а не отсутствующие поля.
            // Number.isFinite(undefined) = false, так что ветка с значением
            // достижима только при реально существующем оригинале (`?? 0`
            // защищает тип в этой ветке)
            width: Number.isFinite(metadata.original?.width) ? metadata.original?.width ?? 0 : 0,
            height: Number.isFinite(metadata.original?.height) ? metadata.original?.height ?? 0 : 0,
            duration: metadata.original?.duration ?? null
        },
        tags: metadata.tags || { album: null, genre: null, title: null, artist: null },
        thumbnails: thumbnails,
        hls: false,
        qualities: []
    };

}

/**
 * ***************************************************************************
 * Найти Blob превью по ширине.
 *
 * @param {MediaBlobItem[]} blobs - Результат processMedia.
 * @param {number} width - Ширина превью.
 * @returns {MediaBlobItem | null} - Описание блоба или null.
 * ***************************************************************************
 */
function _findThumbnailBlob(blobs: MediaBlobItem[], width: number): MediaBlobItem | null {

    for (const blob of blobs) {
        if (blob?.kind === "thumbnail" && blob.width === width) return blob;
    }

    return null;

}

/**
 * ***************************************************************************
 * Пустой каркас локальной метадаты.
 *
 * @returns {MediaMetadata} - Каркас metadata.
 * ***************************************************************************
 */
function _emptyDisplayMetadata(): MediaMetadata {

    return {
        v: 2,
        kind: "document",
        flags: { is_audio_note: false, is_video_note: false },
        hls: false,
        qualities: [],
        original: { mime: "", size: 0, width: 0, height: 0, duration: null },
        tags: { album: null, genre: null, title: null, artist: null },
        thumbnails: [],
        placeholder: null,
        colors: null,
        renditions: [],
        wave_form: null
    };

}
