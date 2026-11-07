// Импортируем utils
import type { StoreItem, StoreAddOptions } from "../../utils/store.js";
import type { AttachmentsRaw } from "../../utils/messages/attachments.js";

// Импортируем типы
import type { SecretFileRef } from "../../utils/secret_chats/secret_frames.js";
import type { SecretMessageSender, SecretMessageType, SecretMessageStatus, SecretSelfDestructValue } from "../../types/secret_chats.js";

/**
 * Направление подгрузки страницы истории сообщений (keyset-пагинация).
 */
export type SecretChatDirection = "prev" | "next";

/**
 * ***************************************************************************
 * SecretChatMessageRecord - расшифрованное сообщение в Store формы.
 *
 * Поля записи секретного чата (id/sender/type/status) плюс расшифрованный
 * payload (текст/ответ/файл). Остальные ключи свободно дописываются через
 * индексную сигнатуру `StoreItem` (компонент строки навешивает служебные
 * `__...__`).
 * ***************************************************************************
 */
export interface SecretChatMessageRecord extends StoreItem {

    /** Id сообщения (UUID v7). */
    id: string;

    /** Id секретного чата. */
    chat_id?: string;

    /** Отправитель: "me" | "peer". */
    sender?: SecretMessageSender;

    /** Тип сообщения (text/sticker/…). */
    type?: SecretMessageType;

    /** Статус доставки: queued/sending/sent/delivered/read/failed. */
    status?: SecretMessageStatus;

    /** Таймер самоуничтожения сообщения (null — не действует). */
    self_destruct?: SecretSelfDestructValue | null;

    /** Момент самоуничтожения (epoch ms) — ставится при первом просмотре. */
    self_destruct_at?: number | null;

    /** Текст сообщения (расшифрованный payload; не HTML-экранирован). */
    text?: string | null;

    /** Метаданные вложений из payload (миниатюры уходят впереди оригиналов). */
    files?: SecretFileRef[] | null;

    /** Вложения для рендера (объект-мап по file_id, собирает build_attaches). */
    attachments?: AttachmentsRaw;

    /** Id сообщения, на которое дан ответ (расшифрованный payload). */
    reply_to?: string | null;

    /** Данные сообщения-ответа для отрисовки цитаты (резолвит форма). */
    reply_to_message?: SecretChatMessageRecord | null;

    /** Id файла вложения (расшифрованный payload). */
    file_id?: string | null;

    /** Длительность медиа, мс (расшифрованный payload). */
    duration?: number | null;

    /** Время создания (ISO, из payload отправителя — для сортировки/рендера). */
    created_at?: string;

    /** Черновик (вложения до отправки) — живёт только на клиенте. */
    is_temporary?: boolean;

    /** Флаг «не отправлено» — ошибка доставки (локальное состояние). */
    is_error_sending?: boolean;

    /** Отображённые копии сообщения. */
    __domElements__?: HTMLElement[];

    /** Вызвать редактирование сообщения (навешивает компонент строки). */
    __editMessage__?: () => void;

    /** Отписка компонента от точечных событий Store (снимает событие удаления). */
    __unsubscribeStore__?: () => void;

}

/**
 * ***************************************************************************
 * Опции добавления сообщения в стор, дополненные направлением вставки.
 * ***************************************************************************
 */
export interface SecretChatStoreAddOptions extends StoreAddOptions {

    /** Направление вставки пачки ["prev" | "next"]. */
    direction?: SecretChatDirection;

}

/**
 * ***************************************************************************
 * Сужение опций add до варианта с направлением.
 * @param options - Опции из события item::added.
 * @returns true, если опции содержат направление вставки.
 * ***************************************************************************
 */
export function hasDirection(options: StoreAddOptions | undefined): options is SecretChatStoreAddOptions {
    return typeof options === "object" && options !== null && "direction" in options;
}

/**
 * ***************************************************************************
 * Сужение payload'а стора до сообщения секретного чата.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это сообщение с id-строкой.
 * ***************************************************************************
 */
export function isSecretChatMessageRecord(payload: unknown): payload is SecretChatMessageRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}

/**
 * ***************************************************************************
 * Сужение результата фабрики сообщения до DOM-узла.
 * @param value - Значение (результат фабрики сообщения).
 * @returns true, если это DOM-элемент.
 * ***************************************************************************
 */
export function isDomElement(value: unknown): value is Element {
    return typeof value === "object" &&
        value !== null &&
        "nodeType" in value &&
        "querySelector" in value;
}

/**
 * Настройки формы секретного чата.
 */
export interface SecretChatFormOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы секретного чата.
 */
export interface SecretChatFormData {

    /** Id секретного чата (UUIDv7). */
    chatId: string;

    /** Настройки формы. */
    options?: SecretChatFormOptions;

}
