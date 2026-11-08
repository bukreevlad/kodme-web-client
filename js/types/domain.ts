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
