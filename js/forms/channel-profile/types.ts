// Импортируем типы менеджеров
import type { OverlayScrollbars } from "overlayscrollbars";

// Импортируем типы utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем типы медиа-просмотрщика
import type { MediaItemMetadata } from "../media-viewer/types.js";

// Импортируем типы форм
import type { ChannelProfile } from "./index.js";

// Переэкспортируем тип формы: компоненты/функции/события берут его из
// types.ts, а не из index.ts, чтобы не тянуть в модули сам класс
export type { ChannelProfile };

/**
 * Тип отписки от события (возвращается Store.on и слушателей).
 */
export type Unsubscribe = () => void;

/**
 * Метаданные записи секции: контракт медиа-просмотрщика (превью, рендерации,
 * оригинал) плюс поля аудио/голосовых и placeholder-заглушки.
 */
export interface ChannelSectionItemMetadata extends MediaItemMetadata {

    /** LQIP-placeholder (data-URI) под основной картинкой. */
    placeholder?: string;

    /** Аудиотеги файла. */
    tags?: { artist?: string; title?: string };

    /** Осциллограмма голосового (амплитуды 0..1). */
    wave_form?: number[];

    /** Длительность (секунды). */
    duration?: number;

    /** Флаги аудиофайла. */
    flags?: { is_audio_note?: boolean };

    /** Прочие поля метадаты, которые клиент не читает. */
    [key: string]: unknown;

}

/**
 * Запись секции профиля канала — ответ сервера плюс служебные поля
 * компонентов строк (`__domElements__`, `__update__` и т.д.).
 */
export interface ChannelSectionItemData extends StoreItem {

    /** Имя файла. */
    name?: string;

    /** Отображаемое имя файла (приоритет над name). */
    file_name?: string;

    /** Размер файла (байты). */
    size?: number;

    /** Токен доступа к файлу в storage. */
    token?: string;

    /** Ссылка на сообщение-владельца вложения
     * ({ type: "message", id }): есть не у всех записей — вложения,
     * загруженные вне постов, приходят без неё. */
    entity_context?: { type?: string; id?: string } | null;

    /** MIME-тип файла. */
    mime_type?: string;

    /** Имя автора (строки «Ссылок» и аудио). */
    display_name?: string;

    /** Дата поста, которому принадлежит запись (ISO 8601); может отсутствовать. */
    created_at?: string | null;

    /** Название аудиофайла. */
    title?: string;

    /** Исполнитель аудиофайла. */
    author?: string;

    /** Id вложения — курсор пагинации (у «Ссылок» сообщение отдаёт id вместо него). */
    attachment_id?: string;

    /** Превью текста сообщения (строки «Ссылок»). */
    text_preview?: string;

    /** Ссылки сообщения (строки «Ссылок»). */
    urls?: string[];

    /** Временный id ещё не загруженного файла. */
    temp_id?: string;

    /** Локальный файл (ещё не загружен на сервер). */
    _file?: Blob | File;

    /** Локальный uri загруженного файла. */
    __local_uri__?: string;

    /** Метаданные записи. */
    metadata?: ChannelSectionItemMetadata;

    /** Отображённые DOM-элементы строки (снимает subscribe_section). */
    __domElements__?: Element[];

    /** Точечное обновление строки (навешивает компонент). */
    __update__?: (data: ChannelSectionItemData) => void;

    /** Получение актуальных данных строки (навешивает компонент). */
    __getData__?: () => ChannelSectionItemData;

    /** Отписка от точечного события Store (снимает teardown через removeAll). */
    __unsubscribeStore__?: Unsubscribe | null;

    /** Отписка компонента от глобальных событий (аудиоплейер). */
    __destroy__?: Unsubscribe | null;

}

/**
 * Ключ свойства формы с Store секции.
 */
export type SectionStoreKey =
    | "photoStore"
    | "videoStore"
    | "fileStore"
    | "audioStore"
    | "urlStore"
    | "audioNoteStore";

/**
 * Ключ свойства формы с контейнером списка секции.
 */
export type SectionListKey =
    | "listPhotos"
    | "listVideos"
    | "listFiles"
    | "listUrls"
    | "listAudioNotes"
    | "listAudios";

/**
 * Ключ свойства формы с экземпляром OverlayScrollbars панели секции.
 */
export type SectionScrollKey =
    | "osListPhotosScrollInstance"
    | "osListVideosScrollInstance"
    | "osListFilesScrollInstance"
    | "osListUrlsScrollInstance"
    | "osListVoicesScrollInstance"
    | "osListAudiosScrollInstance";

/**
 * Локализованный ключ заголовка секции.
 */
export type SectionLocaleKey = "photos" | "videos" | "files" | "urls" | "voices" | "audios";

/**
 * Экземпляр строки секции: компонент отдаёт свой DOM-элемент, а не this.
 */
export interface SectionItemInstance {

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

}

/**
 * Класс строки секции (new (form, data) => SectionItemInstance).
 */
export type SectionItemClass = new (form: ChannelProfile, data: ChannelSectionItemData) => SectionItemInstance;

/**
 * Описание секции (вкладки) профиля канала.
 */
export interface MediaSection {

    /** Идентификатор вкладки (совпадает с `data-target`; от него же выводится состояние пагинации). */
    id: string;

    /** Ключ свойства формы с Store секции. */
    storeKey: SectionStoreKey;

    /** Ключ свойства формы с контейнером списка. */
    listKey: SectionListKey;

    /** Ключ свойства формы с экземпляром OverlayScrollbars панели. */
    scrollKey: SectionScrollKey;

    /** Событие сокета для загрузки секции. */
    event: string;

    /** Ключ заголовка вкладки в локали. */
    localeKey: SectionLocaleKey;

    /** Раскладка списка: сетка (фото/видео) или вертикальный список. */
    layout: "grid" | "list";

    /** Иконка пустого состояния (tabler, kebab-case). */
    icon: string;

    /** Класс строки секции. */
    component: SectionItemClass;

}

/**
 * Опции добавления элемента секции: направление пачки определяет, куда
 * вставлять строку (prev — в начало списка).
 */
export interface SectionAddOptions extends StoreAddOptions {

    /** Направление пачки из ответа сервера. */
    direction?: "prev" | "next" | undefined;

}

/**
 * Экземпляр OverlayScrollbars, зарегистрированный на форме.
 */
export interface ScrollbarEntry {

    /** Имя свойства формы, куда сохранён экземпляр. */
    property: string;

    /** Экземпляр скроллбара. */
    instance: OverlayScrollbars;

}
