// Импортируем utils
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";
import type { MediaItemMetadata } from "../../media-viewer/types.js";
import type { MessageRecord } from "../types.js";

// Импортируем forms (только типы)
import type { Messages } from "../index.js";

/**
 * Аргумент команды бота: пара «ключ — значение» либо отдельное значение.
 */
export interface BotCommandArg {

    /** Ключ аргумента (пишется брендовым цветом). */
    key?: string;

    /** Значение аргумента. */
    value?: string | number | boolean;

    /** Кавычки вокруг отдельного значения (строка-разделитель). */
    isQuoted?: string;

}

/**
 * ***************************************************************************
 * MessageEntity - сущность текста сообщения, которую распознал сервер:
 * команда бота, mention, обычная ссылка или облачная ссылка.
 * ***************************************************************************
 */
export interface MessageEntity {

    /** Тип сущности ["bot-command" | "mention" | "link" | ...]. */
    type?: string;

    /** Команда бота без ведущего "/". */
    command?: string;

    /** Разобранные аргументы команды бота. */
    args_array?: BotCommandArg[];

    /** Ссылка mention'а (username либо код приглашения). */
    link?: string;

    /** URL обычной ссылки. */
    url?: string;

    /** Id пользователя (mention). */
    userId?: string;

    /** Mention ведёт на бота. */
    isBot?: boolean;

    /** Id приложения бота (mention BotApp). */
    botAppId?: string;

    /** Id канала (mention канала). */
    channelId?: string;

}

/**
 * Аватар автора реакции (для рендера стопки в кнопке реакции).
 */
export interface MessageReactionAvatar {

    /** Id автора реакции. */
    user_id?: string;

    /** Отображаемое имя автора. */
    display_name?: string;

    /** Аватар автора. */
    avatar?: AvatarImageDocument | null;

}

/**
 * Emoji-реакция на сообщение (одна кнопка в блоке реакций).
 */
export interface MessageReaction {

    /** Emoji-реакция. */
    reaction?: string;

    /** Число поставивших. */
    count?: number;

    /** Поставил ли её текущий пользователь. */
    is_selected?: boolean;

    /** Авторы реакций (рендерятся аватарками). */
    avatars?: MessageReactionAvatar[];

}

/**
 * Инлайн-кнопка сообщения (от бота).
 */
export interface MessageButton {

    /** Текст кнопки. */
    text?: string;

    /** Id кнопки (payload от бота, отправляется на клик). */
    id?: string;

    /** Состояние кнопки (payload от бота, отправляется на клик). */
    state?: string;

    /** Дополнительные классы (применяются с белым фильтром). */
    classes?: string[] | string;

    /** Прочие поля payload кнопки (читает message_button_click). */
    [key: string]: unknown;

}

/**
 * Строка кнопок сообщения (массив кнопок в одном ряду).
 */
export type MessageButtonRow = MessageButton[];

/**
 * Один элемент ветки локали system_messages (шаблоны конкретного action_type).
 */
export interface SystemMessageLocaleEntry {

    /** Строковый шаблон с {{placeholders}}. */
    string?: string;

    /** Составной шаблон (массив частей). */
    array?: string[] | string;

    /** Прочие формы шаблона (склонения и т.п.). */
    [key: string]: unknown;

}

/**
 * Ветка локали system_messages: action_type → шаблоны.
 */
export type SystemMessagesLocale = Record<string, SystemMessageLocaleEntry>;

/**
 * Payload системного сообщения (поля зависят от action_type).
 */
export interface SystemActionPayload {

    /** Id пользователя-участника события. */
    user_id?: string;

    /** Имя пользователя. */
    user_name?: string;

    /** Отображаемое имя (приоритет над user_name). */
    display_name?: string;

    /** Участник — бот. */
    is_bot?: boolean;

    /** Название группы (переименование). */
    group_name?: string;

    /** Id трансляции. */
    cast_id?: string;

    /** Время старта трансляции/звонка (ISO). */
    started_at?: string;

    /** Время окончания (ISO). */
    ended_at?: string;

    /** Время приёма звонка (ISO). */
    accepted_at?: string;

    /** Прочие поля payload. */
    [key: string]: unknown;

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
 * Родительский компонент сообщения, которым владеют reply/forward/футеры:
 * им нужны данные сообщения, форма и корневой элемент.
 */
export interface MessageHost {

    /** Экземпляр формы сообщений. */
    form: Messages;

    /** Данные сообщения. */
    data: MessageData;

    /** Корневой DOM-элемент сообщения. */
    element: HTMLElement;

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

/**
 * ***************************************************************************
 * MessageData - данные сообщения, которые читают компоненты сообщения.
 *
 * Расширяют `MessageRecord` (хранилище формы) полями рендера: автор, текст,
 * сущности, реакции, кнопки, ответ/пересылка и служебные `__...__`-хуки,
 * которые навешивает компонент сообщения.
 * ***************************************************************************
 */
export interface MessageData extends MessageRecord {

    /** Время создания (ISO). */
    created_at?: string;

    /** Отображаемое имя автора. */
    display_name?: string;

    /** Аватар автора. */
    avatar?: AvatarImageDocument | null;

    /** Тип канала (1 — диалог, 3 — канал и т.д.). */
    channel_type?: number;

    /** Количество комментариев под постом (заполняется сервером, канал type = 3). */
    count_comments?: number;

    /** Разрешено ли комментирование поста (наследуется от канала, может быть переключено). */
    is_commenting?: boolean;

    /** Автор — бот. */
    is_bot?: boolean;

    /** Текущий пользователь — модератор канала. */
    is_moderator?: boolean;

    /** Флаг «не отправлено» — ошибка отправки. */
    is_error_sending?: boolean;

    /** Тип системного сообщения (для системных сообщений). */
    action_type?: string;

    /** Payload системного сообщения. */
    action_payload?: SystemActionPayload;

    /** Сущности текста (команды бота, mention'ы, ссылки). */
    entities?: MessageEntity[];

    /** Реакции сообщения. */
    reactions?: MessageReaction[] | undefined;

    /** Инлайн-кнопки сообщения (строки кнопок). */
    buttons?: MessageButtonRow[];

    /** Сообщение, на которое отвечаем. */
    reply_to_message?: MessageData | null;

    /** Id сообщения, на которое отвечаем. */
    reply_to_message_id?: string | null;

    /** Пересланное сообщение. */
    forwarded_message?: MessageData | null;

    /** Id сообщения, откуда выполнена пересылка. */
    forwarded_to_message_id?: string | null;

    /** Id пользователя-источника (для перехода из блока пересылки). */
    user_id?: string;

    /** Id бота-источника (для перехода из блока пересылки). */
    bot_id?: string;

    /** Отписка компонента от точечных событий Store (снимает Main). */
    __unsubscribeStore__?: () => void;

}
