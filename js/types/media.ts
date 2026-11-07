// ***************************************************************************
// Доменные типы медиа-конвейера клиента «Код.me».
//
// Контракт метадаты v2 (metadata вложения) собирается целиком на клиенте
// (см. utils/media/media_processor): превью, цвета, длительность, теги и
// рендерации. Типы здесь — единый источник для генераторов (image/, video/,
// audio/), сборщика метадаты (media/) и компонентов вложений, которые эти
// поля читают. Локальные поля показа (_file/_url в thumbnails) дополняют
// серверный контракт и живут в нём же — компоненты работают и с локальным
// файлом до загрузки, и с уже загруженным вложением.
// ***************************************************************************

/** Категория вложения по контракту метадаты v2. */
export type MediaKind = "image" | "audio" | "audio_note" | "video" | "video_note" | "document";

/** Источник акцентных цветов (блок colors). */
export type MediaColorSource = "image" | "video_frame" | "audio_cover";

/** Роль производного файла в blobs — по ней файл сопоставляется с целью загрузки. */
export type MediaBlobKind = "original" | "thumbnail" | "rendition";

/**
 * Вход медиа-конвейера: файл или блоб. Часть источников приносит с собой
 * уже накопленную метадату (поле metadata у File из IndexedDB/импорта).
 */
export interface MediaInput extends Blob {
    /** Имя файла (заполнено у File). */
    name?: string;
    /** Ранее собранная метадата (переиспользуется, если уже есть). */
    metadata?: Partial<MediaMetadata>;
}

/**
 * Блок original метадаты: размеры и длительность оригинала.
 * mime/size заполняются при сборке, но на границе внешних данных
 * (сообщение из БД/сервера) могут отсутствовать — читаем через ?.
 */
export interface MediaOriginal {
    /** MIME оригинала. */
    mime?: string;
    /** Размер оригинала в байтах. */
    size?: number;
    /** Ширина (известна для image/video/обложек; < 1 не отправляется). */
    width?: number;
    /** Высота (< 1 не отправляется). */
    height?: number;
    /** Длительность в секундах (аудио/видео). */
    duration?: number | null;
    [key: string]: unknown;
}

/**
 * Превью в metadata.thumbnails. Контракт v2 несёт только width/size
 * (height/mime_type дополняет сервер), локальный показ добавляет Blob
 * (_file) и blob:-ссылку (_url) ещё не загруженного превью.
 */
export interface MediaThumbnail {
    /** Ширина превью (белый список сервера: 400/800/1200). */
    width: number;
    /** Размер превью в байтах. */
    size?: number | undefined;
    /** Высота превью. */
    height?: number;
    /** MIME превью (обычно image/webp). */
    mime_type?: string;
    /** Локальный Blob превью (живёт в вкладке/IndexedDB). */
    _file?: Blob | null;
    /** Локальная blob:-ссылка превью (протухает после перезагрузки). */
    _url?: string | null;
}

/** Теги аудиоконтейнера (ID3/Vorbis). */
export interface MediaTags {
    /** Название трека. */
    title?: string | null;
    /** Исполнитель. */
    artist?: string | null;
    /** Альбом. */
    album?: string | null;
    /** Жанр. */
    genre?: string | null;
}

/** Акцентные цвета, извлечённые из изображения/кадра (результат извлечателя). */
export interface ImageColors {
    /** Доминирующий цвет в формате "#rrggbb". */
    dominant: string;
    /** Акцентный цвет в формате "#rrggbb". */
    accent: string;
    /** Тёмная ли подложка (средняя яркость < 128). */
    is_dark: boolean;
}

/** Блок colors контракта метадаты (с провайдером цвета). */
export interface MediaColors {
    /** Доминирующий цвет или null, если цветов нет. */
    dominant: string | null;
    /** Акцентный цвет или null. */
    accent: string | null;
    /** Тёмная ли подложка (null — не определено). */
    is_dark: boolean | null;
    /** Откуда взят цвет: изображение, кадр видео или обложка аудио. */
    source?: MediaColorSource;
}

/** Блок renditions контракта метадаты (меню качества в плеере). */
export interface MediaRendition {
    /** Метка качества (360/720/1080). */
    label: string;
    /** Ширина рендерации. */
    width: number;
    /** Размер рендерации в байтах. */
    size: number;
}

/** Рендерация, которую вернул генератор (метка + сам файл). */
export interface VideoRenditionItem {
    /** Метка качества (360/720/1080). */
    label: string;
    /** Ширина рендерации. */
    width: number;
    /** Высота рендерации. */
    height: number;
    /** Собранный MP4-файл. */
    blob: Blob;
    /** MIME рендерации. */
    mimeType: string;
    /** Размер в байтах. */
    bytes: number;
}

/**
 * Метадата вложения — контракт v2 + локальные поля показа.
 * Все поля опциональны: метадата приходит из разных источников (сборка на
 * клиенте, сервер, хранилище), индексная сигнатура покрывает доп. поля
 * (пути объектов, локальные ссылки на превью), которые кладутся через spread.
 * Флаги заметок — ТОЛЬКО в `flags`, корневое дублирование удалено.
 */
export interface MediaMetadata {
    /** Версия контракта метадаты (2). */
    v?: number;
    /** Категория вложения. */
    kind?: MediaKind;
    /** Флаги категорий заметок. */
    flags?: {
        /** Голосовая заметка. */
        is_audio_note?: boolean;
        /** Видеозаметка. */
        is_video_note?: boolean;
    };
    /** Оригинальный файл. */
    original?: MediaOriginal;
    /** Превью. */
    thumbnails?: MediaThumbnail[];
    /** LQIP-placeholder (валидный data-URI webp) либо null. */
    placeholder?: string | null;
    /** Акцентные цвета либо null. */
    colors?: MediaColors | null;
    /** Рендерации качества. */
    renditions?: MediaRendition[];
    /** Теги аудио либо null. */
    tags?: MediaTags | null;
    /** Осциллограмма (60 точек) либо null. */
    wave_form?: number[] | null;
    /** HLS-поток (собирает сервер; локально всегда false). */
    hls?: boolean;
    /** Доступные качества (заполняет сервер; локально пусто). */
    qualities?: unknown[];
    [key: string]: unknown;
}

/** Производный файл, который надо залить по выданным policy. */
export interface MediaBlobItem {
    /** Роль файла (original | thumbnail | rendition). */
    kind: MediaBlobKind;
    /** Ширина превью/рендерации. */
    width?: number;
    /** Высота превью. */
    height?: number;
    /** Метка рендерации качества. */
    label?: string;
    /** Сам файл. */
    blob: Blob;
    /** MIME файла. */
    mime_type: string;
}

/** Шаг прогресса обработки для UI. */
export interface MediaProgressItem {
    /** Человекочитаемая подпись шага (см. ru.json для локализации). */
    label: string;
    /** Процент завершения (0..100). */
    percent: number;
}

/** Результат обработки: метадата для БД + файлы для загрузки + прогресс. */
/**
 * Метадата, собранная конструктором пустого каркаса: блоки `original`,
 * `thumbnails` и `renditions` в ней всегда существуют (заполнены сразу),
 * поэтому ветки обработки могут писать в них без проверок на отсутствие.
 */
export type ProcessMediaMetadata = MediaMetadata & Required<Pick<MediaMetadata, "original" | "thumbnails" | "renditions">>;

export interface ProcessMediaResult {
    /** Метадата (контракт v2) — идёт в БД. */
    metadata: ProcessMediaMetadata;
    /** Файлы для загрузки по выданным policy. */
    blobs: MediaBlobItem[];
    /** Прогресс обработки. */
    progress: MediaProgressItem[];
}

/** Доп. флаги вложения (имеют приоритет над kind). */
export interface AttachmentExtra {
    /** Голосовая заметка. */
    is_audio_note?: boolean;
    /** Видеозаметка. */
    is_video_note?: boolean;
    [key: string]: unknown;
}

/** Опции обработки медиа. */
export interface ProcessMediaOptions {
    /** Категория (иначе определяется по расширению и MIME). */
    kind?: string | undefined;
    /** Доп. флаги вложения. */
    extra?: AttachmentExtra;
    /** Искать обложку у аудио (по умолчанию true). */
    withCover?: boolean;
    /** Считать осциллограмму (по умолчанию true). */
    waveForm?: boolean;
    /** Строить рендерации видео (по умолчанию true). */
    withRenditions?: boolean;
    /** Уже посчитанная дорожка — переиспользуется. */
    wave_form?: number[] | undefined;
    /** Уже известная длительность в секундах. */
    duration?: number | undefined;
    /** Секунда кадра-превью для видео. */
    seekTime?: number;
}

/**
 * Общий результат генераторов превью (изображение / обложка / кадр видео).
 * Цвета и placeholder считаются здесь же, чтобы компоненты получали
 * единый набор полей до и после загрузки.
 */
export interface ThumbnailGeneratorResult {
    /** Оригинальные размеры и MIME/размер файла. */
    original: MediaOriginal;
    /** Собранные превью (с локальными _file/_url). */
    thumbnails: MediaThumbnail[];
    /** LQIP-placeholder (data-URI webp). */
    placeholder: string;
    /** Акцентные цвета либо null. */
    colors: ImageColors | null;
}

/** Результат генератора превью видео (дополняет общий результат). */
export interface VideoThumbnailResult extends ThumbnailGeneratorResult {
    /** HLS локально ещё не существует — всегда false. */
    hls: boolean;
    /** Теги контейнера (локально пусто). */
    tags: Record<string, unknown>;
    /** Доступные качества (локально пусто). */
    qualities: unknown[];
    /** Осциллограмма (локально пусто). */
    wave_form: number[];
}
