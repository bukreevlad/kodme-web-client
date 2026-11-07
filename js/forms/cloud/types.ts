// Импортируем utils
import type { StoreItem } from "../../utils/store.js";

// Импортируем components
import type { ProgressIndicator } from "../../components/progress.js";

// Импортируем типы
import type { MediaMetadata } from "../../types/media.js";

/**
 * Режим формы облака: своё облако, доступные ссылки, общий доступ.
 */
export type CloudMode = "mine" | "available" | "shared";

/**
 * Режим элемента списка (навигация): своё облако либо общий доступ.
 */
export type CloudItemMode = "mine" | "shared";

/**
 * Режим просмотра списка: список либо плитка.
 */
export type CloudView = "list" | "grid";

/**
 * Тип элемента облака.
 */
export type CloudItemType = "folder" | "file";

/**
 * Уровень доступа по ссылке общего доступа.
 */
export type CloudAccessLevel = "read" | "write" | "owner";

/**
 * Направление загрузки страницы (keyset-пагинация).
 */
export type CloudPaginationDirection = "prev" | "next";

/**
 * Папка в стеке навигации («Моё облако» и «Общий доступ»).
 */
export interface CloudFolderEntry {

    /** Id папки. */
    id: string;

    /** Имя папки. */
    name?: string | null | undefined;

}

/**
 * ***************************************************************************
 * CloudItem - элемент облака в хранилище формы (папка или файл).
 *
 * Поля — только те, что реально читает код формы: строки списков, шапка,
 * загрузка файлов. Служебные ключи (__domElements__, __progressInstances__,
 * __uploader__) живут здесь же, потому что их пишут и читают компоненты
 * и подписки стора.
 ***************************************************************************
 */
export interface CloudItem extends StoreItem {

    /** Id элемента (UUID сервера либо временный id загрузки). */
    id: string;

    /** Тип элемента. */
    item_type: CloudItemType;

    /** Id строки облака (для файлов приходит отдельным полем item_id). */
    item_id?: string;

    /** Id документа в storage (для файлов). */
    document_id?: string | undefined;

    /** Id родительской папки (null — корень). */
    parent_id?: string | null | undefined;

    /** Имя элемента (сервер может отдать null, например у папки). */
    name?: string | null | undefined;

    /** Оригинальное имя файла. */
    file_name?: string;

    /** Размер файла в байтах. */
    size?: number;

    /** Дата создания (ISO-строка). */
    created_at?: string | undefined;

    /** Флаг «файл ещё загружается» (временный элемент с прогрессом). */
    is_uploading?: boolean;

    /** Расширение файла. */
    extname?: string;

    /** MIME-тип файла. */
    mime_type?: string;

    /** Токен доступа к файлу. */
    token?: string;

    /** Метаданные медиа (превью, цвета и т.п.). */
    metadata?: MediaMetadata | null;

    /** Локальный файл (живёт до ответа сервера). */
    _file?: File;

    /** Отображённые копии элемента (папка/файл попадает в список дважды). */
    __domElements__?: HTMLElement[];

    /** Инстансы прогресса загрузки (по одному на DOM-копию). */
    __progressInstances__?: ProgressIndicator[];

    /** Загрузчик файла (для отмены по кнопке прогресса). */
    __uploader__?: { destroy(): void };

}

/**
 * Ссылка в списке «Доступное для меня».
 */
export interface CloudAvailableLink extends StoreItem {

    /** Id записи в списке (id ссылки). */
    id: string;

    /** Id ссылки в БД. */
    link_id: string;

    /** Значение ссылки (токен). */
    link: string;

    /** Имя элемента, на который ведёт ссылка. */
    item_name?: string | null;

    /** Уровень доступа. */
    access_level?: CloudAccessLevel;

    /** Имя владельца ссылки. */
    owner_first_name?: string | null;

    /** Фамилия владельца ссылки. */
    owner_last_name?: string | null;

    /** Срок действия (ISO-строка). */
    expires_at?: string | null;

    /** Отображённые копии строки. */
    __domElements__?: HTMLElement[];

}

/**
 * Строка cloud_share_links в ответах сервисов облака.
 */
export interface CloudShareLinkRow {

    /** Id ссылки. */
    id: string;

    /** Значение ссылки (токен). */
    link: string;

    /** Id владельца ссылки. */
    owner_user_id?: string | null;

    /** Id элемента, на который ведёт ссылка. */
    item_id?: string;

    /** Тип элемента. */
    item_type?: CloudItemType;

    /** Уровень доступа. */
    access_level?: CloudAccessLevel;

    /** Срок действия (ISO-строка). */
    expires_at?: string | null;

    /** Дата создания (ISO-строка). */
    created_at?: string;

}

/**
 * Элемент, на который ведёт ссылка общего доступа.
 */
export interface CloudSharedItem {

    /** Id элемента. */
    id: string;

    /** Тип элемента. */
    item_type: CloudItemType;

    /** Имя элемента. */
    name?: string | null;

    /** Id документа (для файлов). */
    document_id?: string | null;

}

/**
 * Владелец ссылки общего доступа.
 */
export interface CloudSharedOwner {

    /** Id владельца. */
    user_id?: string;

    /** Имя владельца. */
    first_name?: string | null;

    /** Фамилия владельца. */
    last_name?: string | null;

}

/**
 * Данные открытой ссылки общего доступа (форма хранит их для навигации).
 */
export interface CloudSharedLink {

    /** Id ссылки. */
    id?: string;

    /** Значение ссылки (токен). */
    link?: string;

    /** Id владельца ссылки. */
    owner_user_id?: string | null;

    /** Уровень доступа текущего пользователя. */
    access_level?: CloudAccessLevel;

    /** Элемент, на который ведёт ссылка. */
    item?: CloudSharedItem;

    /** Владелец ссылки. */
    owner?: CloudSharedOwner;

}

/**
 * Данные файла из token-payload сервера (get folder / open share link /
 * save file): подпись доступа плюс поля документа.
 */
export interface CloudFilePayload {

    /** Id документа в storage. */
    id: string;

    /** Оригинальное имя файла. */
    file_name?: string;

    /** Расширение файла. */
    extname?: string;

    /** MIME-тип файла. */
    mime_type?: string;

    /** Размер файла в байтах. */
    size?: number;

    /** Токен доступа к файлу. */
    token?: string;

    /** Метаданные медиа (превью, цвета и т.п.). */
    metadata?: MediaMetadata | null;

}

/**
 * Папка в ответах сервисов облака (строка cloud_items; читаются только id
 * и имя — остальное хранилище переносит как есть).
 */
export interface CloudFolderRow {

    /** Id папки. */
    id: string;

    /** Имя папки. */
    name?: string | null | undefined;

}

/**
 * Файл в ответах сервисов облака: token-payload плюс поля строки облака.
 */
export interface CloudFileRow extends CloudFilePayload {

    /** Id строки облака. */
    item_id: string;

    /** Id родительской папки (null — корень). */
    parent_id?: string | null;

    /** Имя элемента. */
    name?: string;

    /** Дата создания (ISO-строка). */
    created_at?: string;

}

/**
 * ***************************************************************************
 * Сужение payload'а стора до элемента облака.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это элемент облака с id-строкой и типом.
 ***************************************************************************
 */
export function isCloudItem(payload: unknown): payload is CloudItem {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string" &&
        "item_type" in payload &&
        (payload.item_type === "folder" || payload.item_type === "file");
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до ссылки «Доступное для меня».
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это запись доступной ссылки с id-строкой.
 ***************************************************************************
 */
export function isCloudAvailableLink(payload: unknown): payload is CloudAvailableLink {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string" &&
        "link_id" in payload;
}
