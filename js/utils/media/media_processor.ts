// Импортируем config
import { getKindByExtension, getKindByMime, resolveMimeType } from "../../config/file_types.js";
import { MEDIA_THUMBNAIL_SIZES, MEDIA_WAVE_FORM_POINTS } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../logs/logger.js";
import { generateImageMetadata } from "../image/image_thumbnail_generator.js";
import { generateVideoMetadata } from "../video/video_thumbnail_generator.js";
import { extractAudioMetadata } from "../audio/audio_metadata_extractor.js";
import { getWaveformPoints } from "../audio/wave_bars_generator.js";
import { generateVideoRenditions } from "../video/video_renditions_generator.js";

// Импортируем типы
import type {
    MediaInput,
    MediaKind,
    MediaMetadata,
    MediaOriginal,
    MediaThumbnail,
    MediaTags,
    ImageColors,
    MediaColors,
    MediaBlobItem,
    MediaProgressItem,
    ProcessMediaResult,
    ProcessMediaMetadata,
    ProcessMediaOptions,
    MediaColorSource,
    ThumbnailGeneratorResult
} from "../../types/media.js";

// Максимум ожидания длительности аудио. Без этого битый заголовок держал бы
// обработку вложений намертво: голосовая запись не отправится никогда.
const DURATION_TIMEOUT_MS = 5000;

/**
 * ***************************************************************************
 * Ширины превью — клиентская константа (config/constants.js).
 *
 * Только эти ширины сервер подписывает и генерирует, поэтому остальные мы
 * даже не заявляем — иначе заявленное превью стало бы обязательным к
 * загрузке и падало бы на верификации. Значения обязаны совпадать с
 * серверными `media_processing.media.thumbnail_sizes`.
 *
 * @returns Копия списка ширин (mutable — генератор принимает number[]).
 * ***************************************************************************
 */
function thumbnailWidths(): number[] {

    return [...MEDIA_THUMBNAIL_SIZES];

}

/**
 * ***************************************************************************
 * Единая точка обработки медиа перед загрузкой.
 *
 * Здесь собираются превью, цвета, звуковая дорожка и рендерации видео и
 * возвращаются единым объектом, который и поедет в S3, и в БД.
 *
 * `blobs` отделены от `metadata`: метадата (контракт v2) идёт в БД и не
 * содержит Blob'ов, а `blobs` — файлы для загрузки по выданным policy.
 *
 * Функция никогда не бросает исключения: одно битое вложение не должно
 * отменять импорт остальных (в худшем вернётся каркас без превью).
 *
 * @param {MediaInput} file - Файл вложения.
 * @param {ProcessMediaOptions} [options] - Опции обработки.
 * @returns {Promise<ProcessMediaResult>} - { metadata, blobs, progress }.
 * ***************************************************************************
 */
export async function processMedia(file: MediaInput, options: ProcessMediaOptions = {}): Promise<ProcessMediaResult> {

    try {

        // ---------- VALIDATE ----------

        // Без файла обрабатывать нечего — отдаём пустой каркас
        if (!file) return _emptyResult(null, options);

        // ---------- SET DEFAULT ----------

        // MIME резолвим, а не берём file.type: для .fb2/.ai/.apk/.tar браузер
        // отдаёт пустую строку, а сервер сверяет original.mime с расширением
        const mime = resolveMimeType(file) || file?.type || "";
        const kind = _resolveKind(file, options);

        // Каркас результата. Ветки ниже заполняют производные.
        const result: ProcessMediaResult = {
            metadata: _createEmptyMetadata(file, kind, mime),
            blobs: [],
            progress: []
        };

        // Оригинал грузится всегда и первым: без него в S3 нечего показать,
        // а превью без оригинала бесполезно.
        result.blobs.push({ kind: "original", blob: file, mime_type: mime });

        // Диагностика: с какого файла началась обработка и в какую ветку ушли.
        Logger.debug(
            `[media] старт: name="${file?.name || "?"}", type="${file?.type || ""}", size=${file?.size} Б, kind=${kind}, withRenditions=${options?.withRenditions !== false}`
        );

        const branchesStartedAt = performance.now();

        // ---------- BRANCHES ----------

        if (kind === "image") await _processImage(file, result);
        if (kind === "audio") await _processAudio(file, result, options);
        if (kind === "audio_note") await _processAudioNote(file, result, options);
        if (kind === "video" || kind === "video_note") await _processVideo(file, result, options, kind);

        // document остаётся каркасом: у документа нет производных вовсе,
        // у него грузится только оригинал.

        Logger.debug(
            `[media] готово: kind=${kind}, превью=${result.metadata.thumbnails.length}, рендераций=${result.metadata.renditions.length}, блобов=${result.blobs.length}, за ${Math.round(performance.now() - branchesStartedAt)} мс`
        );

        return result;

    } catch (error) {

        // Никакой генератор не должен ронять импорт/отправку. Возвращаем
        // пустой каркас: вложение уйдёт без превью, но сообщение сохранится.
        Logger.warn("[ProcessMedia] Не удалось обработать медиа:", error);

        return _emptyResult(file, options);

    }

}

/**
 * ***************************************************************************
 * Пустой результат обработки (каркас метадаты + оригинал).
 *
 * @param {MediaInput | null} file - Исходный файл.
 * @param {ProcessMediaOptions} [options] - Опции обработки.
 * @returns {ProcessMediaResult} - { metadata, blobs, progress }.
 * ***************************************************************************
 */
function _emptyResult(file: MediaInput | null, options: ProcessMediaOptions): ProcessMediaResult {

    const mime = resolveMimeType(file) || file?.type || "";
    const kind = file ? _resolveKind(file, options) : "document";

    return {
        metadata: _createEmptyMetadata(file, kind, mime),
        blobs: file ? [{ kind: "original", blob: file, mime_type: mime }] : [],
        progress: []
    };

}

/**
 * ***************************************************************************
 * Определить категорию контракта v2 (раздел 4.1 плана).
 *
 * Приоритет: флаги заметок из `extra`, затем явный `options.kind`, затем
 * расширение, затем MIME. Не-медийные категории справочника в контракте
 * представляются единой категорией document.
 *
 * @param {MediaInput} file - Файл вложения.
 * @param {ProcessMediaOptions} [options] - Опции обработки.
 * @returns {MediaKind} - image | audio | audio_note | video | video_note | document.
 * ***************************************************************************
 */
function _resolveKind(file: MediaInput, options: ProcessMediaOptions): MediaKind {

    // Явные флаги заметок важнее эвристик по типу
    const extra = options?.extra || {};
    if (extra.is_audio_note) return "audio_note";
    if (extra.is_video_note) return "video_note";

    // Явно переданный kind
    const explicit = _normalizeKind(options?.kind);
    if (explicit) return explicit;

    // Расширение точнее MIME; MIME — запасной путь
    return _normalizeKind(getKindByExtension(file))
        || _normalizeKind(getKindByMime(resolveMimeType(file) || file?.type))
        || "document";

}

/**
 * ***************************************************************************
 * Привести категорию справочника к категории контракта метадаты v2.
 *
 * @param {string} [value] - Категория.
 * @returns {MediaKind | null} - Категория контракта или null.
 * ***************************************************************************
 */
function _normalizeKind(value?: string | null): MediaKind | null {

    if (!value) return null;

    const kind = String(value).toLowerCase();

    if (kind === "image" || kind === "audio" || kind === "video") return kind;
    if (kind === "audio_note" || kind === "video_note") return kind;

    // document и все не-медийные категории справочника
    return "document";

}

/**
 * ***************************************************************************
 * Пустой каркас метадаты контракта v2.
 *
 * Форма повторяет то, что отдаёт validateMediaMetadata на сервере. `original`
 * намеренно БЕЗ width/height/duration: сервер отвергает значения < 1, поэтому
 * ветки добавляют их только когда они достоверно известны.
 *
 * @param {MediaInput | null} file - Исходный файл.
 * @param {MediaKind} kind - Категория метадаты.
 * @param {string} mime - MIME оригинала.
 * @returns {ProcessMediaMetadata} - Каркас metadata с заполненными блоками.
 * ***************************************************************************
 */
function _createEmptyMetadata(file: MediaInput | null, kind: MediaKind, mime: string): ProcessMediaMetadata {

    return {
        v: 2,
        kind: kind,
        flags: {
            is_audio_note: kind === "audio_note",
            is_video_note: kind === "video_note"
        },
        original: {
            mime: mime || "",
            // Number.isFinite(undefined) = false → 0; `?? 0` защищает тип
            size: Number.isFinite(file?.size) ? file?.size ?? 0 : 0
        },
        thumbnails: [],
        placeholder: null,
        colors: null,
        renditions: [],
        tags: null,
        wave_form: null
    };

}

/**
 * ***************************************************************************
 * Ветка «изображение»: превью 400/800/1200, LQIP и акцентные цвета.
 *
 * @param {MediaInput} file - Файл изображения.
 * @param {ProcessMediaResult} result - Собираемый результат.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function _processImage(file: MediaInput, result: ProcessMediaResult): Promise<void> {

    const generated = await generateImageMetadata(file, thumbnailWidths());

    const originalWidth = Number(generated?.original?.width) || 0;
    const originalHeight = Number(generated?.original?.height) || 0;

    // Пропорции нужны и для превью, и для aspect-ratio в списке сообщений
    _applyDimensions(result.metadata.original, originalWidth, originalHeight);

    // Превью и их Blob'ы
    const { metadataThumbs, blobs } = _collectThumbnails(generated, originalWidth);
    result.metadata.thumbnails = metadataThumbs;
    result.blobs.push(...blobs);

    // LQIP для быстрого показа до загрузки полного превью
    if (generated?.placeholder) {
        result.metadata.placeholder = _placeholder(generated.placeholder);
    }

    // Акцентные цвета (источник — само изображение)
    const colors = _colors(generated?.colors, "image");
    if (colors) result.metadata.colors = colors;

    result.progress.push({ label: "Превью и LQIP", percent: 60 });
    result.progress.push({ label: "Акцентные цвета", percent: 100 });

}

/**
 * ***************************************************************************
 * Ветка «аудио»: обложка -> превью, теги, длительность и осциллограмма.
 *
 * @param {MediaInput} file - Аудиофайл (mp3, m4a, flac, wav, ogg).
 * @param {ProcessMediaResult} result - Собираемый результат.
 * @param {ProcessMediaOptions} options - Опции обработки.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function _processAudio(file: MediaInput, result: ProcessMediaResult, options: ProcessMediaOptions): Promise<void> {

    const withCover = options?.withCover !== false;

    // Длительность, теги и обложку читаем из контейнера. Экстрактор не
    // бросает исключений.
    const { metadata: audioMetadata, coverBlob } = await extractAudioMetadata(file);

    _applyDuration(result.metadata.original, audioMetadata?.original?.duration);

    const tags = _tags(audioMetadata?.tags);
    if (tags) result.metadata.tags = tags;

    result.progress.push({ label: "Метаданные и обложка", percent: 25 });

    // ---------- COVER ----------

    if (withCover && coverBlob) {

        const cover = await generateImageMetadata(coverBlob, thumbnailWidths());

        const coverWidth = Number(cover?.original?.width) || 0;
        const coverHeight = Number(cover?.original?.height) || 0;

        // Пропорции обложки кладём в original: сервер выведет из них высоты
        // превью. Без размеров они получат height 0 и сломают aspect-ratio.
        _applyDimensions(result.metadata.original, coverWidth, coverHeight);

        const { metadataThumbs, blobs } = _collectThumbnails(cover, coverWidth);
        result.metadata.thumbnails = metadataThumbs;
        result.blobs.push(...blobs);

        if (cover?.placeholder) {
            result.metadata.placeholder = _placeholder(cover.placeholder);
        }

        const colors = _colors(cover?.colors, "audio_cover");
        if (colors) result.metadata.colors = colors;

    }

    result.progress.push({ label: "Превью обложки", percent: 60 });

    // ---------- WAVE FORM ----------

    const waveForm = await _waveForm(file, options);
    if (waveForm) result.metadata.wave_form = waveForm;

    result.progress.push({ label: "Осциллограмма", percent: 100 });

}

/**
 * ***************************************************************************
 * Ветка «голосовая заметка»: длительность и осциллограмма, без обложки.
 *
 * @param {MediaInput} file - Аудиофайл голосовой заметки.
 * @param {ProcessMediaResult} result - Собираемый результат.
 * @param {ProcessMediaOptions} options - Опции обработки.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function _processAudioNote(file: MediaInput, result: ProcessMediaResult, options: ProcessMediaOptions): Promise<void> {

    // Длительность: переиспользуем известную, иначе читаем минимально —
    // без тегов и обложки
    const duration = Number.isFinite(options?.duration)
        ? options.duration
        : await _readDurationOnly(file);

    _applyDuration(result.metadata.original, duration);

    result.progress.push({ label: "Длительность", percent: 40 });

    const waveForm = await _waveForm(file, options);
    if (waveForm) result.metadata.wave_form = waveForm;

    result.progress.push({ label: "Осциллограмма", percent: 100 });

}

/**
 * ***************************************************************************
 * Ветка «видео» / «видеозаметка»: кадр-превью, цвета, длительность и
 * MP4-рендерации для меню качества.
 *
 * @param {MediaInput} file - Видеофайл.
 * @param {ProcessMediaResult} result - Собираемый результат.
 * @param {ProcessMediaOptions} options - Опции обработки.
 * @param {MediaKind} kind - Категория (video | video_note).
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function _processVideo(file: MediaInput, result: ProcessMediaResult, options: ProcessMediaOptions, kind: MediaKind): Promise<void> {

    const seekTime = Number.isFinite(options?.seekTime) ? options.seekTime : 1;

    const generated = await generateVideoMetadata(file, thumbnailWidths(), seekTime);

    const originalWidth = Number(generated?.original?.width) || 0;
    const originalHeight = Number(generated?.original?.height) || 0;

    _applyDimensions(result.metadata.original, originalWidth, originalHeight);
    _applyDuration(result.metadata.original, generated?.original?.duration);

    const { metadataThumbs, blobs } = _collectThumbnails(generated, originalWidth);
    result.metadata.thumbnails = metadataThumbs;
    result.blobs.push(...blobs);

    if (generated?.placeholder) {
        result.metadata.placeholder = _placeholder(generated.placeholder);
    }

    const colors = _colors(generated?.colors, "video_frame");
    if (colors) result.metadata.colors = colors;

    result.progress.push({ label: "Кадр и превью", percent: 40 });

    // ---------- RENDITIONS ----------

    // Рендерации качества (раздел 9.6 плана). Генератор сам решает, что
    // кодировать: файл больше 100 МБ, отсутствие кодировщика или ошибка
    // дают пустой список — видео уйдёт оригиналом и сыграет прогрессивно.
    //
    // Локальному показу рендерации не нужны.
    // Их строит отправка сообщения — перед запросом URL.
    const withRenditions = options?.withRenditions !== false;
    const renditions = withRenditions ? await generateVideoRenditions(file) : [];

    if (!withRenditions) {
        Logger.debug(`[media] видео: рендерации пропущены (локальный показ)`);
    }

    for (const rendition of renditions) {

        if (!rendition?.blob) continue;

        // В метадату кладём то, что валидирует сервер: метку, ширину и
        // размер. Высоту он выведет из пропорций оригинала сам.
        result.metadata.renditions.push({
            label: rendition.label,
            width: rendition.width,
            size: rendition.blob.size
        });

        // Блоб сопоставится с целью по label (MatchBlobsToTargets)
        result.blobs.push({
            kind: "rendition",
            label: rendition.label,
            blob: rendition.blob,
            mime_type: rendition.mimeType || "video/mp4"
        });

    }

    result.progress.push({ label: "Качество", percent: 100 });

}

/**
 * ***************************************************************************
 * Собрать производные превью одного источника (изображение / обложка / кадр).
 *
 * Оставляем только ширины белого списка сервера и строго меньше ширины
 * оригинала: сервер подписывает именно такие, а заявленное превью становится
 * обязательным к загрузке (verifyUploadedObjects).
 *
 * @param {ThumbnailGeneratorResult} generated - Результат генератора превью.
 * @param {number} originalWidth - Ширина оригинала (0 — неизвестна).
 * @returns {{metadataThumbs: MediaThumbnail[], blobs: MediaBlobItem[]}} - Превью.
 * ***************************************************************************
 */
function _collectThumbnails(generated: ThumbnailGeneratorResult, originalWidth: number): { metadataThumbs: MediaThumbnail[]; blobs: MediaBlobItem[] } {

    const metadataThumbs: MediaThumbnail[] = [];
    const blobs: MediaBlobItem[] = [];
    const seen = new Set<number>();

    for (const thumb of generated?.thumbnails || []) {

        const width = Number(thumb?.width);

        // Ширина вне белого списка сервера — не заявляем
        if (!thumbnailWidths().includes(width)) continue;

        // Превью не повторяет ширину оригинала и не дублируется
        if (originalWidth > 0 && width >= originalWidth) continue;
        if (seen.has(width)) continue;
        if (!thumb?._file) continue;

        seen.add(width);

        metadataThumbs.push({
            width: width,
            size: Number(thumb.size) || thumb._file.size
        });

        blobs.push({
            kind: "thumbnail",
            width: width,
            height: Number(thumb.height) || 0,
            blob: thumb._file,
            mime_type: "image/webp"
        });

    }

    metadataThumbs.sort((a, b) => a.width - b.width);

    return { metadataThumbs, blobs };

}

/**
 * ***************************************************************************
 * Посчитать осциллограмму, если она нужна и ещё не посчитана.
 *
 * @param {MediaInput} file - Аудиофайл.
 * @param {ProcessMediaOptions} options - Опции обработки.
 * @returns {Promise<number[] | null>} - Дорожка или null.
 * ***************************************************************************
 */
async function _waveForm(file: MediaInput, options: ProcessMediaOptions): Promise<number[] | null> {

    // Локальному показу дорожка не нужна, а её расчёт — самая дорогая часть.
    if (options?.waveForm === false) return null;

    // Уже посчитанная дорожка (голосовая заметка из локальной метадаты) —
    // переиспользуем, чтобы не декодировать файл дважды
    if (Array.isArray(options?.wave_form) && options.wave_form.length > 0) {
        return options.wave_form;
    }

    // Точек в осциллограмме — клиентская константа (config/constants.js),
    // значение обязано совпадать с серверным `media_processing.media.wave_form_points`
    const points = await getWaveformPoints(file, MEDIA_WAVE_FORM_POINTS);

    return Array.isArray(points) && points.length > 0 ? points : null;

}

/**
 * ***************************************************************************
 * Добавить размеры в original, только если они достоверны.
 *
 * Сервер отвергает width/height < 1 (INVALID_MEDIA_METADATA), поэтому нули и
 * «неизвестно» не отправляем вовсе — полей просто нет.
 *
 * @param {MediaOriginal} original - Блок original метадаты.
 * @param {number} width - Ширина.
 * @param {number} height - Высота.
 * @returns {void}
 * ***************************************************************************
 */
function _applyDimensions(original: MediaOriginal, width: number, height: number): void {

    if (Number.isSafeInteger(width) && width >= 1
        && Number.isSafeInteger(height) && height >= 1) {
        original.width = width;
        original.height = height;
    }

}

/**
 * ***************************************************************************
 * Добавить длительность в original, только если она достоверна.
 *
 * @param {MediaOriginal} original - Блок original метадаты.
 * @param {number | null} [duration] - Длительность в секундах (может не быть).
 * @returns {void}
 * ***************************************************************************
 */
function _applyDuration(original: MediaOriginal, duration: number | null | undefined): void {

    // Явная проверка на null/undefined нужна для сужения типов,
    // Number.isFinite — для NaN
    if (duration != null && Number.isFinite(duration) && duration >= 0) {
        original.duration = duration;
    }

}

/**
 * ***************************************************************************
 * Нормализовать теги аудио. Все поля пусты — тегов фактически нет.
 *
 * @param {MediaTags | null} [tags] - Теги из контейнера.
 * @returns {MediaTags | null} - { title, artist, album, genre } или null.
 * ***************************************************************************
 */
function _tags(tags?: MediaTags | null): MediaTags | null {

    if (!tags || typeof tags !== "object") return null;

    const out: MediaTags = {
        title: tags.title || null,
        artist: tags.artist || null,
        album: tags.album || null,
        genre: tags.genre || null
    };

    if (!out.title && !out.artist && !out.album && !out.genre) return null;

    return out;

}

/**
 * ***************************************************************************
 * Проверить LQIP перед отправкой.
 *
 * Сервер отвергает пустую строку и мусор (INVALID_MEDIA_METADATA), поэтому
 * отправляем только валидный data-URI webp.
 *
 * @param {unknown} value - Значение из генератора.
 * @returns {string | null} - Валидный LQIP или null.
 * ***************************************************************************
 */
function _placeholder(value: unknown): string | null {

    if (typeof value !== "string") return null;
    if (!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;

    return value;

}

/**
 * ***************************************************************************
 * Собрать блок акцентных цветов контракта v2.
 *
 * @param {ImageColors | null} [colors] - { dominant, accent, is_dark }.
 * @param {MediaColorSource} source - image | video_frame | audio_cover.
 * @returns {MediaColors | null} - { dominant, accent, is_dark, source } или null.
 * ***************************************************************************
 */
function _colors(colors: ImageColors | null | undefined, source: MediaColorSource): MediaColors | null {

    if (!colors || typeof colors !== "object") return null;

    const out: MediaColors = {
        dominant: typeof colors.dominant === "string" ? colors.dominant : null,
        accent: typeof colors.accent === "string" ? colors.accent : null,
        is_dark: typeof colors.is_dark === "boolean" ? colors.is_dark : null,
        source: source
    };

    // Ни доминанты, ни акцента — цвета бесполезны, лучше честный null
    if (!out.dominant && !out.accent) return null;

    return out;

}

/**
 * ***************************************************************************
 * Читает только длительность аудиофайла через нативный HTMLMediaElement.
 *
 * @param {MediaInput} file - Аудиофайл.
 * @returns {Promise<number | null>} - Длительность в секундах или null.
 * ***************************************************************************
 */
function _readDurationOnly(file: MediaInput): Promise<number | null> {

    return new Promise<number | null>(resolve => {

        const audio = document.createElement("audio");
        const url = URL.createObjectURL(file);

        // Снимаем обработчики и освобождаем blob-ссылку ровно один раз
        let done = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const finish = (duration: number | null): void => {
            if (done) return;
            done = true;
            clearTimeout(timer ?? undefined);
            audio.onloadedmetadata = null;
            audio.onerror = null;
            audio.removeAttribute("src");
            audio.load();
            try { URL.revokeObjectURL(url); } catch (e) { }
            resolve(duration);
        };

        // Таймаут: битый контейнер не должен держать обработку намертво
        timer = setTimeout(() => finish(null), DURATION_TIMEOUT_MS);

        audio.onloadedmetadata = () => {
            finish(Number.isFinite(audio.duration) ? audio.duration : null);
        };

        audio.onerror = () => finish(null);

        audio.src = url;

    });

}
