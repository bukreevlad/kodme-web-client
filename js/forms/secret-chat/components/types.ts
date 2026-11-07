// Импортируем utils
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { MediaItemMetadata } from "../../media-viewer/types.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";
import type { SecretChatMessageRecord } from "../types.js";

// Импортируем forms (только типы)
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * SecretChatMessageData - данные сообщения, которые читают компоненты
 * строки секретного чата.
 *
 * Расширяют запись Store полями рендера: имя/аватар собеседника (для
 * входящих сообщений) и служебный хук отписки.
 * ***************************************************************************
 */
export interface SecretChatMessageData extends SecretChatMessageRecord {

    /** Отображаемое имя автора (собеседник — для входящих). */
    display_name?: string;

    /** Аватар автора (собеседник — для входящих). */
    avatar?: AvatarImageDocument | null;

}

/**
 * Родительский компонент сообщения, которым владеют reply/футеры:
 * им нужны данные сообщения, форма и корневой элемент.
 */
export interface SecretChatMessageHost {

    /** Экземпляр формы секретного чата. */
    form: SecretChat;

    /** Данные сообщения. */
    data: SecretChatMessageData;

    /** Корневой DOM-элемент сообщения. */
    element: HTMLElement;

}

/**
 * ***************************************************************************
 * AttachmentMetadata - метадата вложения, которые читают компоненты
 * сообщения: превью/размеры медиа (общий контракт просмотровщика) плюс
 * поля голосовых, видео-кружков и placeholder-заглушек.
 * ***************************************************************************
 */
export interface AttachmentMetadata extends MediaItemMetadata {

    /** LQIP-placeholder (data-URI) под основной картинкой. */
    placeholder?: string;

    /** Осциллограмма голосового (амплитуды 0..1). */
    wave_form?: number[];

    /** Флаги медиа (ветка сборки метадаты). */
    flags?: { is_audio_note?: boolean; is_video_note?: boolean; [key: string]: unknown };

    /** Теги медиафайла (название, исполнитель и т.п.). */
    tags?: {

        /** Название трека. */
        title?: string;

        /** Исполнитель. */
        artist?: string;

    };

    /** Плоская копия длительности (секунды). */
    duration?: number | null;

    /** Прочие поля метадаты, которые клиент не читает. */
    [key: string]: unknown;

}


/**
 * ***************************************************************************
 * AttachmentData - элемент вложения сообщения с честно типизированной
 * метадатой. Форма данных серверного массива и локального object-map
 * (temp/pending) одна и та же — нормализует общий помощник.
 * ***************************************************************************
 */
export interface AttachmentData {

    /** server-side document_id (в temp-режиме отсутствует). */
    id?: string | number | null;

    /** Локальный ключ temp-сообщения. */
    temp_id?: string;

    /** Локальный ключ после получения presigned URL. */
    document_id?: string;

    /** Имя файла. */
    name?: string;

    /** Имя файла (алиас). */
    file_name?: string | undefined;

    /** MIME-тип файла. */
    mime_type?: string;

    /** Тип файла (алиас). */
    type?: string;

    /** Размер в байтах. */
    size?: number;

    /** Токен доступа к защищённому файлу storage. */
    token?: string;

    /** Автор/исполнитель (для аудио). */
    author?: string;

    /** Отображаемое название (для аудио). */
    title?: string;

    /** Локальный файл (предпросмотр до загрузки на сервер; легаси кладёт и Blob). */
    _file?: File | Blob;

    /** Метадата (размеры, длительность, превью, флаги и т.п.). */
    metadata?: AttachmentMetadata;

    /** Отображённые DOM-элементы UI-прогресса. */
    __domElements__?: Element[];

    /** Инстансы UI-прогресса (снимаются компонентом строки). */
    __progressInstances__?: unknown[];

    /** Точечное обновление элемента (навешивает компонент вложения). */
    __update__?: (next: AttachmentData) => void;

    /** Получение актуальных данных элемента (навешивает компонент вложения). */
    __getData__?: () => AttachmentData;

    /** Прочие служебные/серверные поля. */
    [key: string]: unknown;

}


/**
 * ***************************************************************************
 * Сужение до типизированного элемента вложения.
 *
 * Общий нормализатор вложений отдаёт свой внутренний тип с метадатой
 * `Record<string, unknown>`; компонентам нужны честно типизированные поля,
 * поэтому значения пропускаются через guard, а не через каст.
 * @param value - Значение из нормализованного массива вложений.
 * @returns true, если это объект вложения.
 * ***************************************************************************
 */
export function isAttachmentData(value: unknown): value is AttachmentData {
    return typeof value === "object" && value !== null;
}

/**
 * ***************************************************************************
 * Нормализовать вложения сообщения к типизированному массиву.
 *
 * Внутри — общий нормализатор (серверный массив / object-map temp-сообщений),
 * плюс guard-сужение каждого элемента до AttachmentData.
 * @param raw - Исходное значение `attachments` сообщения.
 * @returns Массив элементов вложений (пустой, если вложений нет).
 * ***************************************************************************
 */
export function normalizeAttachments(raw: AttachmentsRaw): AttachmentData[] {
    return Attachments.normalize(raw).filter(isAttachmentData);
}

/**
 * ***************************************************************************
 * sortAttachmentsByFiles - сортировка вложений по порядку метаданных payload.
 *
 * Объект-мап вложений не гарантирует порядок ключей, а в ленте и просмотрщике
 * порядок файлов задают метаданные payload. Вложения без метаданных уходят
 * в конец, порядок остальных не меняется.
 * @param attachments - Вложения сообщения (нормализованный массив).
 * @param files - Метаданные вложений payload (null — порядок не задан).
 * @returns Массив вложений в порядке payload.
 * ***************************************************************************
 */
export function sortAttachmentsByFiles(attachments: AttachmentData[], files: readonly { file_id: string }[] | null | undefined): AttachmentData[] {

    const order = (files ?? []).map((ref) => ref.file_id);
    if (order.length === 0) return attachments;

    return attachments.sort((a, b) => {
        const ai = order.indexOf(String(a.id));
        const bi = order.indexOf(String(b.id));
        return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });

}


/**
 * Структурный минимум данных для сборки превью: текст, имя автора и
 * вложения (массив сервера или мапа temp-записи).
 */
export interface AttachmentStripData {

    /** Отображаемое имя автора. */
    display_name?: string | null;

    /** Текст (HTML-экранирован). */
    text?: string | null;

    /** Вложения (серверный массив или мапа). */
    attachments?: AttachmentsRaw;

    /** Id документа стикера (sticker-сообщение хранит его вне attachments). */
    sticker_document_id?: string | null;

    /** Токен на чтение файла стикера. */
    sticker?: string | null;

}

/**
 * Минимальный «родитель» фабрик вложений (image/video/audio/audio-note):
 * фабрикам нужен только доступ к записи — attachments (для MediaViewer) и
 * display_name (для автора аудио). Структурный тип позволяет переиспользовать
 * те же фабрики вне класса сообщений (форма комментариев), не туда MessageItem.
 */
export interface AttachParent {

    /** Данные сообщения либо комментария. */
    data: {
        attachments?: AttachmentsRaw;
        display_name?: string | null;

        /** Метаданные вложений payload (порядок файлов; нет у комментариев). */
        files?: readonly { file_id: string }[] | null;
    };

}


/**
 * Хост контекстного меню вложения (документ/аудио): минимальный контракт,
 * который нужен обработчику. В миграции компонент-строка стал фабрикой,
 * и наружу отдаётся только нужное действие, а не весь инстанс.
 */
export interface AttachContextMenuHost {

    /** Запуск скачивания вложения (нет у компонентов без загрузчика — у голосового). */
    initDownload?: () => Promise<void>;

}
