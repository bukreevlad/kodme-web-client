// Импортируем utils
import type { StoreItem, StoreAddOptions } from "../../utils/store.js";
import type { AttachmentsRaw } from "../../utils/messages/attachments.js";

// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем типы компонентов формы (реакции сообщения)
import type { MessageReaction } from "./components/types.js";

// Импортируем forms (только типы)
import type { BotMenuBot } from "../bot-menu/index.js";

/**
 * Направление подгрузки страницы истории сообщений (keyset-пагинация).
 */
export type MessagesDirection = "prev" | "next";

/**
 * Тип канала: 1 — диалог, 2 — группа, 3 — канал, 4 — тема группы,
 * 5 — избранное, 6 — чат конференции, 7 — чат трансляции, 8 — диалог с ботом.
 */
export type ChannelType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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

    /** Тип канала. */
    type: number;

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

    /** Включены ли уведомления. */
    is_notifications?: boolean;

    /** Подписан ли текущий пользователь. */
    is_subscribed?: boolean;

    /** Разрешена ли публикация (канал без подписки). */
    is_posting?: boolean;

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

    /** Id группы-родителя (для тем). */
    topic_for_group_id?: string | null;

    /** Id последнего просмотренного сообщения. */
    last_viewed_message_id?: string | null;

    /** Id последнего сообщения, просмотренного собеседником (диалог). */
    display_last_viewed_message_id?: string | null;

    /** Id создателя канала (для проверки прав на удаление «для всех»). */
    created_user_id?: string;

    /** Текущий пользователь — модератор канала. */
    is_moderator?: boolean;

    /** Разрешено ли модератору удалять сообщения «для всех». */
    can_deleted_message?: boolean;

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
    created_user_id?: string | undefined;

    /** Id канала. */
    channel_id?: string;

    /** Текст сообщения. */
    text?: string | null | undefined;

    /** Время создания (ISO). */
    created_at?: string;

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

    /** Число комментариев под постом (сервер для type = 3). */
    count_comments?: number;

    /** Разрешено ли комментирование поста (для type = 3). */
    is_commenting?: boolean;

    /** Флаг «временное» — живёт только на клиенте. */
    is_temporary?: boolean;

    /** Отображённые копии сообщения (одна запись может попасть в список дважды). */
    __domElements__?: HTMLElement[];

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
 * Сужение результата легаси-фабрики сообщения до DOM-узла.
 *
 * Фабрика `components/message.js` конструктором возвращает элемент (`this.element`
 * либо системное сообщение), но её .js-тип — обычный класс без связи с DOM.
 * Сверяемся guard'ом по DOM-приметам (nodeType + querySelector), а не
 * приведением типов. После миграции компонента сообщения на честную фабрику
 * (возвращающую HTMLElement) guard можно будет убрать.
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
