// ***************************************************************************
// Доменные типы клиента «Код.me».
// Единое место кросс-модульных типов: ответы API, конверты WS-протокола,
// доменные сущности. Локальные DTO колокейтятся по фичам рядом с кодом,
// который ими пользуется; сюда — только то, что используют несколько
// подсистем. Зависимостей от runtime-кода здесь быть не должно (только type).
// ***************************************************************************

/** ISO-строка метки времени. */
export type IsoTimestamp = string;

/**
 * Успешный ответ API — форма { data, status: true, timestamp }.
 * Такой конверт формирует сервер для каждого успешного ответа.
 * @param T - тип полезной нагрузки data.
 */
export interface Answer<T = undefined> {
    /** Полезная нагрузка ответа. */
    data: T;
    /** Флаг успеха — у успешных ответов всегда true. */
    status: true;
    /** Время формирования ответа. */
    timestamp: IsoTimestamp;
}

/**
 * Структурированная ошибка сервера в конверте callback'а.
 * Сервер сериализует её из AppError: { message, code, status, reason, details }.
 */
export interface ServerErrorPayload {
    /** Человекочитаемое сообщение (или код ошибки в легаси-ответах). */
    message?: string;
    /** Код ошибки, например "INVALID_NAME", "RATE_LIMIT_EXCEEDED". */
    code?: string | undefined;
    /** Причина отказа (например, для RATE_LIMIT_EXCEEDED). */
    reason?: string | undefined;
    /** HTTP-статус, с которым сформирована ошибка (429 и т.п.). */
    status?: number;
    /** Дополнительные данные ошибки. */
    details?: unknown;
}

/**
 * Входящий конверт события сокета: сервер шлёт событие и (опционально)
 * callbackId — клиент обязан ответить первым результатом обработчика.
 */
export interface WsEventMessage {
    /** Дискриминатор конверта. */
    type: "event";
    /** Имя события, например "[group]: get settings" или "message::new". */
    event: string;
    /** Полезная нагрузка события (провалидирована сервером). */
    data: unknown;
    /** Идентификатор колбэка — заполнен, если событие ждёт ответа. */
    callbackId?: string;
    /** Время отправки события (ms). */
    timestamp: number;
}

/**
 * Входящий конверт ответа на emitWithAck: ошибка (строка либо
 * структурированный объект) или данные.
 */
export interface WsCallbackMessage {
    /** Дискриминатор конверта. */
    type: "callback";
    /** Идентификатор соответствующего запроса. */
    callbackId: string;
    /** Ошибка ответа: строка (легаси) или ServerErrorPayload, либо null. */
    error: unknown;
    /** Данные ответа. */
    data: unknown;
}

/**
 * Входящий конверт серверной ошибки уровня сокета (не привязана к запросу).
 */
export interface WsErrorMessage {
    /** Дискриминатор конверта. */
    type: "error";
    /** Полезная нагрузка ошибки. */
    error: unknown;
}

/** Любое входящее сообщение сокета (дискриминатор — поле type). */
export type WsIncomingMessage = WsEventMessage | WsCallbackMessage | WsErrorMessage;

/** Исходящий конверт события (emitWithAck — с callbackId, emit — без). */
export interface WsOutgoingMessage {
    /** Дискриминатор конверта. */
    type: "event";
    /** Имя события. */
    event: string;
    /** Полезная нагрузка. */
    data: unknown;
    /** Идентификатор колбэка (только для запросов с ожиданием ответа). */
    callbackId?: string;
    /** Время отправки (ms). */
    timestamp: number;
}

/** Исходящий конверт ответа-колбэка серверу на событие с callbackId. */
export interface WsOutgoingCallback {
    /** Дискриминатор конверта. */
    type: "callback";
    /** Идентификатор колбэка события. */
    callbackId: string;
    /** Ошибка обработки: { message } либо null. */
    error: { message: string } | null;
    /** Результат обработки события. */
    data: unknown;
}

/**
 * Вид канала: диалог, группа, сообщество, тема, избранное, чат конференции
 * или чат трансляции.
 */
export type ChannelKind = "dialog" | "group" | "channel" | "topic" | "favorite" | "meet_chat" | "cast_chat";

/** Тип события ленты канала (единый поток живых и догоняющих обновлений). */
export type ChannelFeedEventType =
    | "message_new"
    | "message_edit"
    | "message_deleted"
    | "history_cleared"
    | "messages_cleaned"
    | "member_joined"
    | "member_left"
    | "member_banned"
    | "member_unbanned"
    | "channel_created"
    | "channel_removed"
    | "channel_updated"
    | "topic_created";

/**
 * Событие ленты канала: живой толчок `[channel]: feed` и элемент догонки
 * `[channel]: get updates` — одного формата. Применяется по порядку `pts`.
 */
export interface ChannelFeedEvent {
    /** Id канала. */
    channel_id: string;
    /** Тип события. */
    type: ChannelFeedEventType;
    /** Позиция события в ленте канала. */
    pts: number;
    /** Полезная нагрузка события (у сообщений может содержать готовые данные). */
    payload: Record<string, unknown>;
    /** Время события (заполняется в догонке). */
    created_at?: IsoTimestamp;
}

/** Тип события личной ленты пользователя (появление и исчезновение каналов). */
export type UserFeedEventType =
    | "channel_created"
    | "channel_removed";

/**
 * Событие личной ленты пользователя: живой толчок `[user]: feed` и элемент
 * догонки `[user]: get updates` — одного формата. Применяется по порядку
 * `upid`.
 */
export interface UserFeedEvent {
    /** Позиция события в личной ленте. */
    upid: number;
    /** Тип события. */
    type: UserFeedEventType;
    /** Полезная нагрузка события ({ channel_id }). */
    payload: Record<string, unknown>;
    /** Время события (заполняется в догонке). */
    created_at?: IsoTimestamp;
}

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

    /** Id звонка. */
    call_id?: string;

    /** Статус звонка: ringing → missed | declined | canceled | finished. */
    status?: string;

    /** Длительность разговора в секундах (finished). */
    duration?: number | null;

    /** Время старта трансляции/звонка (ISO). */
    started_at?: string;

    /** Время окончания (ISO). */
    ended_at?: string;

    /** Время приёма звонка (ISO). */
    accepted_at?: string;

    /** Прочие поля payload. */
    [key: string]: unknown;

}
