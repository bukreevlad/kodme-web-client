// Импортируем utils
import type { StoreAddOptions, StoreItem } from "../../utils/store.js";

// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем типы
import type { ChannelKind, SystemActionPayload } from "../../types/domain.js";
import type { SecretFileRef } from "../../utils/secret_chats/secret_frames.js";
import type { SecretMessageType } from "../../types/secret_chats.js";

/**
 * ***************************************************************************
 * TYPES - доменные типы главной формы (сайдбар каналов).
 *
 * Здесь живут записи, которыми форма делится со стором и IndexedDB: канал
 * (строка списка), сообщение (превью чата) и папки вкладок. Полей объявлено
 * ровно столько, сколько читает и пишет эта форма: серверная строка шире, а
 * лишнее в тип не выносится, чтобы не врать о контракте.
 *
 * Служебный ключ (__updateStatusRead__) пишут компоненты строк — он
 * объявлен здесь же.
 * ***************************************************************************
 */

/** Папка главного экрана: общая «Все» и папки пользователя. */
export interface MainFolder {

    /** Id папки (UUID v7; "all" — общая папка, живёт только на клиенте). */
    id: string;

    /** Название папки. */
    name: string;

}

/** Вложение сообщения: поля, которые читает превью чата в списке каналов. */
export interface ChannelAttachment {

    /**
     * Свободные ключи вложения: сервер присылает и другие служебные
     * поля (document_id, размер, тип) — они сохраняются в записи,
     * но в доменном типе не читаются.
     */
    [key: string]: unknown;

    /** MIME-тип вложения (определяет группу медиа в превью). */
    mime_type?: string;

    /** Название файла. */
    name?: string;

    /** Имя файла на диске. */
    file_name?: string;

    /** Служебные данные вложения (плейсхолдер, флаги типа). */
    metadata?: ChannelAttachmentMetadata;

}

/** Служебные данные вложения. */
export interface ChannelAttachmentMetadata {

    /**
     * Свободные ключи метаданных: сервер кладёт сюда размеры,
     * длительности, превью и прочие служебные данные — индексная
     * сигнатура сохраняет их при передаче в другие формы.
     */
    [key: string]: unknown;

    /** Data-URL превью (картинка-заглушка). */
    placeholder?: string;

    /** Флаги типа вложения. */
    flags?: {

        /** Голосовое сообщение. */
        is_audio_note?: boolean;

        /** Видеосообщение (кружок). */
        is_video_note?: boolean;

    };

}

/**
 * Превью последнего сообщения секретного чата: расшифрованные данные payload
 * (своя логика — данные приходят шифрованными, сервер о них не знает).
 */
export interface SecretPreviewMessage {

    /** Id сообщения (UUID v7). */
    id: string;

    /** Id чата-владельца. */
    channel_id: string;

    /** Время создания (ISO, из payload отправителя). */
    created_at?: string;

    /** Id автора (для отметки «Вы:» и статуса доставки). */
    created_user_id?: string | undefined;

    /** Отображаемое имя автора. */
    display_name?: string;

    /** Текст (расшифрованный payload; не экранирован сервером). */
    text?: string | null;

    /** Тип сообщения (стикер живёт вне вложений). */
    type?: SecretMessageType;

    /** Метаданные вложений payload (подписи и превью собираются из них). */
    files?: SecretFileRef[] | null;

    /** Сообщение не ушло (ошибка доставки). */
    is_error_sending?: boolean;

}

/** Сообщение в сторе/IndexedDB: строка чата и превью списка каналов. */
export interface MessageRecord extends StoreItem {

    /** Id сообщения (UUID v7). */
    id: string;

    /** Id канала-владельца. */
    channel_id: string;

    /** Время создания (ISO-строка). */
    created_at?: string;

    /** Id автора. */
    author_id?: string | undefined;

    /** Отображаемое имя автора. */
    display_name?: string;

    /** Текст сообщения (сервер присылает экранированным). */
    text?: string | null | undefined;

    /** Тип системного действия (задан — сообщение системное). */
    action_type?: string | null;

    /** Полезные данные системного действия (статус звонка и т.п.). */
    action_payload?: SystemActionPayload | null;

    /** Вложения. */
    attachments?: ChannelAttachment[] | null;

    /**
     * Клиентский ключ идемпотентности (поле объекта с сервера: ключ,
     * с которым сообщение отправлено).
     */
    random_id?: string | null;

    /** Сообщение ещё не подтверждено ответом сервера. */
    is_pending?: boolean;

    /** Сообщение-заглушка: заменяется серверным эхом. */
    is_temporary?: boolean;

    /** Сообщение не ушло (ошибка отправки). */
    is_error_sending?: boolean;

    /** Число комментариев под постом (заполняется сервером для type = 3). */
    count_comments?: number;

    /** Личный флаг комментирования поста (null — наследует настройку канала). */
    is_commenting?: boolean | null;

    /** Служебная подписка строки сообщения на обновление статуса прочтения. */
    __updateStatusRead__?: () => void;

}

/** Канал в сторе/IndexedDB главной формы: строка списка и её состояние. */
export interface ChannelRecord extends StoreItem {

    /** Id канала (UUID v7). */
    id: string;

    /** Вид канала. */
    kind?: ChannelKind;

    /** Секретный чат (локальная запись из secret_chats, а не канал сервера). */
    is_secret_chat?: boolean;

    /** Отображаемое название. */
    display_name?: string;

    /** Id собеседника (диалог). */
    display_user_id?: string;

    /** Онлайн-статус собеседника. */
    display_user_is_online?: boolean;

    /** Аватар канала (документ файла). */
    avatar?: AvatarImageDocument | null;

    /** Подписка на уведомления (null — подписки нет). */
    notifications?: { mode: "all" | "none" | "mentions" } | null;

    /** Пользователь подписан на канал. */
    is_subscribed?: boolean;

    /** Пользователь участник канала. */
    is_member?: boolean;

    /** Последнее сообщение (превью чата серверного канала). */
    last_message?: MessageRecord | null | undefined;

    /** Последнее сообщение секретного чата (расшифрованные данные payload). */
    last_secret_message?: SecretPreviewMessage | null | undefined;

    /** Id последнего сообщения. */
    last_message_id?: string | null;

    /** Id первого сообщения (нижняя граница истории). */
    first_message_id?: string | null;

    /** Последняя применённая точка ленты событий канала (для догонки). */
    last_pts?: number | undefined;

    /** Счётчик непрочитанных: сервер присылает строкой, клиент пишет числом. */
    total_unread_messages?: string | number;

    /** Позиция прочитанного текущим пользователем. */
    last_read_id?: string | null;

    /** Позиция прочитанного собеседником (для отметок прочтения). */
    display_last_read_id?: string | null;

    /** Id папок, в которые добавлен канал. */
    main_folders_ids?: string[];

    /** Id родительской группы (заполнен у тем). */
    parent_channel_id?: string | null;

    /** Id владельца канала (для проверки прав модерации). */
    owner_id?: string;

    /** Id владельца родительской группы — для тем его права равны правам владельца темы. */
    parent_owner_id?: string | null;

    /** Текущий пользователь — модератор канала. */
    is_moderator?: boolean;

    /** Разрешено ли модератору удалять все сообщения участника. */
    can_clean_messages?: boolean;

    /** Разрешено ли модератору блокировать участников. */
    can_restrict_members?: boolean;

    /** Разрешено ли модератору писать в сущности с «Только администратор». */
    can_posting_messages?: boolean;

    /** Темы группы (приходят в списке чатов; в IndexedDB не сохраняются). */
    topics?: ChannelRecord[];

}

/**
 * Опции добавления элемента в стор.
 *
 * Стор прокидывает `direction` в событие item::added: по нему подписчики
 * списка понимают, в какой край страницы встала строка. Передаётся
 * отдельной переменной, а не литералом: стор принимает StoreAddOptions
 * (без direction), и литерал упёрся бы в проверку свежих объектов.
 */
export interface AddPageOptions extends StoreAddOptions {

    /** Направление вставки страницы. */
    direction?: "prev" | "next";

}

/**
 * Значение — объект с полями (базовая проверка guard'ов сокетных нагрузок).
 * @param value - Проверяемое значение.
 * @returns true, если значение объектно.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Нагрузка — запись канала: сервер подтверждает контракт целиком, а guard
 * сверяет идентификатор (единственное обязательное поле типа).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на канал.
 */
export function isChannelRecord(value: unknown): value is ChannelRecord {
    return isRecord(value) && typeof value.id === "string";
}

/**
 * Нагрузка — запись сообщения: обязательны id и канал-владелец.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на сообщение.
 */
export function isMessageRecord(value: unknown): value is MessageRecord {
    return isRecord(value) && typeof value.id === "string" && typeof value.channel_id === "string";
}

/**
 * Нагрузка — канал с темами: сверяем и состав topics, иначе раскладка тем
 * в БД получила бы мусор вместо записей каналов.
 * @param value - Проверяемое значение.
 * @returns true, если значение канал, а topics (если передан) — массив каналов.
 */
export function isChannelWithTopics(value: unknown): value is ChannelRecord {

    if (!isChannelRecord(value)) return false;

    // invariant: topics приходит только у групп и всегда массивом записей
    const topics = value.topics;
    return topics === undefined || (Array.isArray(topics) && topics.every(isChannelRecord));

}

/**
 * Счётчик непрочитанных из данных канала: сервер отдаёт строкой, клиент
 * пишет числом, а мусор должен давать NaN.
 * @param value - Значение поля total_unread_messages.
 * @returns Число либо NaN, если значение не читается.
 */
export function parseUnread(value: string | number | undefined): number {
    return parseInt(String(value), 10);
}
