// Импортируем utils
import type { StoreItem, StoreAddOptions } from "../../utils/store.js";
import type { AttachmentsRaw } from "../../utils/messages/attachments.js";

// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем типы
import type { ChannelKind, SystemActionPayload } from "../../types/domain.js";

// Импортируем типы компонентов формы (реакции сообщения)
import type { MessageReaction } from "./components/types.js";

// Импортируем forms (только типы)
import type { BotMenuBot } from "../bot-menu/index.js";

/**
 * Направление подгрузки страницы истории сообщений (keyset-пагинация).
 */
export type MessagesDirection = "prev" | "next";

/**
 * ***************************************************************************
 * ChannelRecord - канал в форме сообщений (шапка чата, контекстное меню,
 * бейджи непрочитанных).
 *
 * Поля — только те, что реально читает код формы: шапка (`_update`),
 * контекстное меню и синхронизация локальных хранилищ. Запись приходит и из
 * IndexedDB, и из ответа сервера, поэтому часть полей опциональна.
 * ***************************************************************************
 */
export interface ChannelRecord extends StoreItem {

    /** Id канала. */
    id: string;

    /** Вид канала. */
    kind: ChannelKind;

    /** Отображаемое имя канала/диалога. */
    display_name: string;

    /** Id собеседника (только для диалога). */
    display_user_id?: string;

    /** Онлайн ли собеседник (диалог/бот). */
    display_user_is_online?: boolean;

    /** Время последней активности собеседника (ISO) или null. */
    display_last_action_at?: string | null;

    /** Аватар канала/диалога. */
    avatar?: AvatarImageDocument | null;

    /** Подписка на уведомления (null — подписки нет). */
    notifications?: { mode: "all" | "none" | "mentions" } | null;

    /** Подписан ли текущий пользователь. */
    is_subscribed?: boolean;

    /** Режим публикации: все подписанные либо только администраторы. */
    posting_mode?: "all" | "admins";

    /** Закрыт ли канал администратором платформы. */
    is_closed?: boolean;

    /** Число подписчиков (группа/канал). */
    total_members?: number;

    /**
     * Число непрочитанных. Клиент приводит его к числу через parseInt, а при
     * синхронизации темы группы записывает пустую строку — поэтому и число,
     * и строка.
     */
    total_unread_messages?: number | string;

    /** Id последнего сообщения канала. */
    last_message_id?: string;

    /** Id папок, в которые входит канал. */
    main_folders_ids?: string[];

    /** Id родительской группы (для тем). */
    parent_channel_id?: string | null;

    /** Позиция прочитанного текущим пользователем. */
    last_read_id?: string | null;

    /** Позиция прочитанного собеседником (диалог). */
    display_last_read_id?: string | null;

    /** Id владельца канала (для проверки прав на удаление «для всех»). */
    owner_id?: string;

    /** Id владельца родительской группы — для тем его права равны правам владельца темы. */
    parent_owner_id?: string | null;

    /** Текущий пользователь — модератор канала. */
    is_moderator?: boolean;

    /** Разрешено ли модератору удалять сообщения «для всех». */
    can_deleted_message?: boolean;

    /** Разрешено ли модератору удалять все сообщения участника. */
    can_clean_messages?: boolean;

    /** Разрешено ли модератору блокировать участников. */
    can_restrict_members?: boolean;

    /** Разрешено ли модератору писать в сущности с «Только администратор». */
    can_posting_messages?: boolean;

    /** Темы группы (в ответе сервера `[channel]: open`). */
    topics?: ChannelRecord[];

    /** Команды бота (для меню бота в диалоге). */
    bots?: BotMenuBot[];

}

/**
 * ***************************************************************************
 * MessageRecord - сообщение в Store формы.
 *
 * Поля — только те, что реально читает код формы (события стора, обработчики
 * ввода). Остальные ключи сообщения свободно дописываются через индексную
 * сигнатуру `StoreItem` (компонент сообщения навешивает служебные `__...__`).
 * ***************************************************************************
 */
export interface MessageRecord extends StoreItem {

    /** Id сообщения (UUID v7). */
    id: string;

    /** Id автора. */
    author_id?: string | undefined;

    /** Забанен ли автор сообщения модерацией (пункт «Разблокировать» в меню). */
    author_is_blocked?: boolean;

    /** Является ли автор сообщения модератором канала. */
    is_moderator?: boolean;

    /** Id канала. */
    channel_id?: string;

    /** Текст сообщения. */
    text?: string | null | undefined;

    /** Время создания (ISO). */
    created_at?: string;

    /** Тип системного действия (задан — сообщение системное). */
    action_type?: string | null;

    /** Полезные данные системного действия (статус звонка и т.п.). */
    action_payload?: SystemActionPayload | null;

    /** Вложения (массив либо объект-мап локальной формы). */
    attachments?: AttachmentsRaw;

    /** Id документа стикера (sticker-сообщение). */
    sticker_document_id?: string | null | undefined;

    /** Id набора стикера (sticker-сообщение). */
    sticker_pak_id?: string | null | undefined;

    /** Токен на чтение файла стикера (query `?token=…` ссылки хранилища). */
    sticker?: string | null | undefined;

    /** Ожидает ответа сервера (исходящее). */
    is_pending?: boolean;

    /** Запись очереди: задача редактирования — новые файлы к существующему сообщению. */
    is_edit?: boolean;

    /** Число комментариев под постом (сервер для type = 3). */
    count_comments?: number;

    /** Личный флаг комментирования поста (null — наследует настройку канала). */
    is_commenting?: boolean | null;

    /** Флаг «временное» — живёт только на клиенте. */
    is_temporary?: boolean;

    /** Вызвать редактирование сообщения (навешивает компонент сообщения). */
    __editMessage__?: () => void;

    /** Обновить статус «прочитано» (навешивает компонент сообщения). */
    __updateStatusRead__?: () => void;

    /**
     * Обновить реакции сообщения (навешивает компонент сообщения).
     * Тип параметра — тот же, что передаёт реакциям `reactions_updater`
     * (массив реакций сообщения; null компонент трактует как «реакций нет»).
     */
    __updateReactions__?: (reactions: MessageReaction[] | null) => void;

}

/**
 * ***************************************************************************
 * Опции добавления сообщения в стор, дополненные направлением вставки.
 *
 * Стор пробрасывает options подписчикам `item::added` как есть (см. Store.add
 * → emit), поэтому направление ["prev" | "next"] реально доходит до события.
 * ***************************************************************************
 */
export interface MessageStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: MessagesDirection;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением: сверяемся guard'ом, потому
 * что в базовом типе опций поле direction не объявлено.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 * ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is MessageStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до сообщения.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это сообщение с id-строкой.
 * ***************************************************************************
 */
export function isMessageRecord(payload: unknown): payload is MessageRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до канала (событие `item::updated::<id>` в Store
 * главного экрана). Store.update() эмитит событие и когда элемента нет в
 * Map (payload undefined) — guard отсекает и этот случай.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это канал с id.
 * ***************************************************************************
 */
export function isChannelRecord(payload: unknown): payload is ChannelRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload;
}

/**
 * ***************************************************************************
 * Сужение результата фабрики сообщения до DOM-узла.
 *
 * Фабрика `components/message.js` конструктором возвращает элемент (`this.element`
 * либо системное сообщение), но её .js-тип — обычный класс без связи с DOM.
 * Сверяемся guard'ом по DOM-приметам (nodeType + querySelector).
 * @param value - Значение (результат конструктора фабрики сообщения).
 * @returns true, если это DOM-элемент.
 * ***************************************************************************
 */
export function isDomElement(value: unknown): value is Element {
    return typeof value === "object" &&
        value !== null &&
        "nodeType" in value &&
        "querySelector" in value;
}
