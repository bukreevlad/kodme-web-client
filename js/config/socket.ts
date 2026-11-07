// Импортируем utils
import { Logger } from "../utils/logs/logger.js";

// Импортируем ошибки API
import { ApiError } from "../utils/network/api_error.js";

// Импортируем типы
import type {
    Answer,
    ServerErrorPayload,
    WsCallbackMessage,
    WsErrorMessage,
    WsEventMessage,
    WsIncomingMessage,
    WsOutgoingCallback,
    WsOutgoingMessage
} from "../types/domain.js";

/**
 * ***************************************************************************
 * Опции подключения WebSocket-клиента. Значения по умолчанию задаются
 * в конструкторе, поверх них spread'ом ложатся опции вызывающего.
 * ***************************************************************************
 */
export interface SocketOptions {

    /** Автопереподключение после обрыва. */
    autoReconnect: boolean;

    /** Лимит попыток: 0 — бесконечные (после лимита продолжаем редкими попытками). */
    reconnectAttempts: number;

    /** Начальная задержка реконнекта (мс). */
    reconnectDelay: number;

    /** Максимальная задержка реконнекта (мс). */
    maxReconnectDelay: number;

    /** Время ожидания открытия сокета (мс). */
    timeout: number;

    /** Время ожидания ответа на событие по умолчанию (мс). */
    defaultAckTimeout: number;

    /** Пинг сервера для детекции «полумёртвых» соединений. */
    heartbeatEnabled: boolean;

    /** Период пинга (мс). */
    heartbeatInterval: number;

    /** Время ожидания ответа на пинг (мс). */
    heartbeatTimeout: number;

    /** Сколько раз подряд нет ответа → принудительный реконнект. */
    heartbeatMisses: number;

}

/**
 * Счётчики диагностики соединения (см. getStats()).
 */
export interface SocketStats {

    /** Отправлено сообщений. */
    messagesSent: number;

    /** Получено сообщений. */
    messagesReceived: number;

    /** Попыток подключения. */
    connectionAttempts: number;

    /** Выполнено реконнектов. */
    reconnects: number;

    /** Зафиксировано ошибок. */
    errors: number;

    /** Отправлено запросов с ожиданием ответа (ack). */
    acksSent: number;

    /** Получено ответов (ack). */
    acksReceived: number;

}

/**
 * Отложенный колбэк ожидания ответа (ack): промис запроса + его таймер.
 * Методы объявлены методами (не свойствами-функциями) ради бивариантности
 * параметров: в Map ложатся resolve/reject разных generic-инстанциаций.
 */
interface PendingCallback {

    /** Принять ответ сервера. */
    resolve(value: unknown): void;

    /** Отклонить ожидание (таймаут, разрыв или ошибка сервера). */
    reject(reason?: unknown): void;

    /** Таймер ожидания ack. */
    timeout: ReturnType<typeof setTimeout>;

    /** Имя события — для диагностики. */
    event: string;

}

/**
 * Обработчик события сокета. Если вернёт не `undefined` и у конверта есть
 * `callbackId` — результат уходит серверу как ответ на событие (ack).
 */
export type SocketEventHandler = (data: unknown, timestamp?: number) => unknown;

/**
 * ***************************************************************************
 * Распознать входящий конверт по дискриминатору `type`.
 *
 * Контракт с собственным сервером: шлются ровно три формы конвертов
 * (см. WsIncomingMessage). Runtime-валидация полей — на сервере, здесь
 * достаточно разделить ветви разбора.
 * @param value - Разобранное JSON-значение.
 * @returns {boolean} - true, если значение — конверт сокета.
 * ***************************************************************************
 */
function isWsIncomingMessage(value: unknown): value is WsIncomingMessage {

    if (typeof value !== "object" || value === null || !("type" in value)) return false;

    return value.type === "event" || value.type === "callback" || value.type === "error";

}

/**
 * ***************************************************************************
 * Сузить источник до полей серверной ошибки (см. ServerErrorPayload).
 *
 * Поля читаются только с проверкой типа: данные приходят по сети, и поле
 * `status: false` (признак неуспешного data-ответа) не должно попадать
 * в HTTP-статус ошибки.
 * @param value - Источник: конверт ошибки либо data-ответ.
 * @returns {ServerErrorPayload} - Поля серверной ошибки (может быть пустым).
 * ***************************************************************************
 */
function toServerErrorPayload(value: unknown): ServerErrorPayload {

    if (typeof value !== "object" || value === null) return {};

    const payload: ServerErrorPayload = {};

    if ("message" in value && typeof value.message === "string" && value.message) payload.message = value.message;
    if ("code" in value && typeof value.code === "string" && value.code) payload.code = value.code;
    if ("reason" in value && typeof value.reason === "string" && value.reason) payload.reason = value.reason;
    if ("status" in value && typeof value.status === "number") payload.status = value.status;
    if ("details" in value && value.details) payload.details = value.details;

    return payload;

}

/**
 * ***************************************************************************
 * Текст ошибки для конверта-ответа серверу: сообщение ошибки либо строковое
 * представление значения (легаси брало `error.message || String(error)`).
 * @param error - Значение, брошенное обработчиком события.
 * @returns {string} - Текст ошибки.
 * ***************************************************************************
 */
function formatErrorMessage(error: unknown): string {

    if (typeof error === "object" && error !== null && "message" in error && error.message) {
        return String(error.message);
    }

    return String(error);

}

/**
 * Признак неуспешного data-ответа: конверт `{ type: "error" }` либо
 * ответ `{ status: false }` (легаси-проверка в _handleCallback).
 * @param data - Полезная нагрузка callback-конверта.
 * @returns {boolean} - true, если ответ неуспешен.
 */
function isFailedAnswer(data: unknown): boolean {

    if (typeof data !== "object" || data === null) return false;
    if ("type" in data && data.type === "error") return true;
    if ("status" in data && data.status === false) return true;

    return false;

}

/**
 * ***************************************************************************
 * Socket - WebSocket-клиент RPC-границы «Код.me».
 *
 * Собственный клиент (не socket.io): конверты протокола — типы из
 * `types/domain.ts`, запросы идут через
 * `Socket.client.timeout(ms).emitWithAck<T>(event, data)` и возвращают
 * `Promise<Answer<T>>` (форма успешного ответа сервера).
 *
 * Синглтон приложения: `Socket.client` создаётся при входе в сессию
 * (`new Socket(url, options)`) и используется всеми модулями запросов.
 * ***************************************************************************
 */
export class Socket {

    /** Текущий клиент основного сокета (единственный на приложение; null — до входа в сессию). */
    private static _client: Socket | null = null;

    /**
     * ***************************************************************************
     * Клиент основного сокета.
     *
     * Геттер — guard на инварианте «сокет создаётся при входе в сессию»:
     * раньше чтение до инициализации падало с TypeError на месте вызова,
     * теперь — с явной ошибкой с тем же синхронным выбросом (обработчики
     * ловят её так же, как ловили бы TypeError).
     * @throws {Error} Если клиент ещё не создан (запрос вне сессии).
     * @returns {Socket} Экземпляр клиента.
     * ***************************************************************************
     */
    static get client(): Socket {
        if (!Socket._client) {
            throw new Error("Socket: клиент не инициализирован — сокет создаётся при входе в сессию");
        }
        return Socket._client;
    }

    /** Задать клиента основного сокета (при входе в сессию). */
    static set client(client: Socket) {
        Socket._client = client;
    }

    /** URL подключения. */
    url: string;

    /** Опции подключения (значения по умолчанию + опции вызывающего). */
    options: SocketOptions;

    /** Текущее соединение (null — до подключения и после разрыва). */
    ws: WebSocket | null = null;

    /** Открыто ли соединение. */
    isConnected = false;

    /** Счётчик попыток переподключения. */
    reconnectCount = 0;

    /** Ожидающие ответа запросы по callbackId. */
    callbacks = new Map<string, PendingCallback>();

    /** Подписки на события по имени события. */
    eventHandlers = new Map<string, SocketEventHandler[]>();

    /** Таймер ожидания открытия соединения. */
    connectionTimeout: ReturnType<typeof setTimeout> | null = null;

    /** Текущий таймаут ожидания ack (сбрасывается в defaultAckTimeout после каждого запроса). */
    currentTimeout: number;

    /** Идёт ли сейчас реконнект. */
    _isReconnecting = false;

    /** Таймер отложенного реконнекта. */
    _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /** Промис текущего подключения (защита от гонок connect()). */
    _connectingPromise: Promise<Event> | null = null;

    /** Таймер heartbeat-пинга. */
    _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    /** Пропущено ответов на пинг подряд. */
    _heartbeatMisses = 0;

    /** Уже ли сообщали о достижении лимита попыток. */
    _limitNotified = false;

    /** Счётчики диагностики соединения. */
    stats: SocketStats = {
        messagesSent: 0,
        messagesReceived: 0,
        connectionAttempts: 0,
        reconnects: 0,
        errors: 0,
        acksSent: 0,
        acksReceived: 0
    };

    /**
     * ***************************************************************************
     * Создаёт клиент и настраивает его (само подключение — connect()).
     * @param {string} url - URL сокета (путь API, разрешается относительно страницы).
     * @param {Partial<SocketOptions>} [options] - Опции поверх значений по умолчанию.
     * ***************************************************************************
     */
    constructor(url: string, options?: Partial<SocketOptions>) {
        this.url = url;
        this.options = {
            autoReconnect: true,
            reconnectAttempts: 0,       // 0 или false = бесконечные попытки (после лимита продолжаем редкими попытками)
            reconnectDelay: 2000,       // Начальная задержка
            maxReconnectDelay: 10000,   // Максимальная задержка
            timeout: 10000,             // Время ожидания открытия сокета
            defaultAckTimeout: 10000,   // Время ожидания ответа на событие
            heartbeatEnabled: true,     // Пинг сервера для детекции "полумёртвых" соединений
            heartbeatInterval: 15000,   // Период пинга
            heartbeatTimeout: 5000,     // Время ожидания ответа на пинг
            heartbeatMisses: 3,         // Сколько раз подряд нет ответа → принудительный реконнект
            ...options
        };

        this.currentTimeout = this.options.defaultAckTimeout;

        Logger.debug("[app][ws]: Клиент инициализирован");
    }

    // ***************************************************************************
    // Проверка состояния
    // ***************************************************************************
    _isReady(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isConnected;
    }

    /**
     * Дождаться открытия сокета: опрашивает состояние до таймаута.
     * @param {number} [timeout=10000] - Максимальное время ожидания (мс).
     * @returns {Promise<boolean>} - true, если сокет открылся.
     */
    async _waitForOpen(timeout = 10000): Promise<boolean> {
        if (this._isReady()) return true;

        return new Promise<boolean>((resolve) => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (this._isReady()) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });
    }

    /**
     * Задать таймаут ожидания ответа для следующего запроса (один раз).
     * @param {number} timeout - Время в мс.
     * @returns {Socket} - Текущий клиент (для цепочки вызовов).
     */
    timeout(timeout: number): this {
        if (typeof timeout !== "number" || timeout <= 0) return this;
        this.currentTimeout = timeout;
        return this;
    }

    _resetTimeout(): void {
        this.currentTimeout = this.options.defaultAckTimeout;
    }

    // ***************************************************************************
    // Методы отправки
    // ***************************************************************************
    /**
     * Запрос с ожиданием ответа (RPC-граница): событие уходит с callbackId,
     * промис завершается ответом сервера либо ошибкой (таймаут/разрыв/ошибка API).
     * @param {string} eventName - Имя события, например "[group]: get settings".
     * @param {unknown} [data] - Полезная нагрузка запроса.
     * @param {number|null} [customTimeout=null] - Таймаут запроса (мс) вместо текущего.
     * @returns {Promise<Answer<T>>} - Ответ сервера { data, status, timestamp }.
     */
    async emitWithAck<T = unknown>(eventName: string, data?: unknown, customTimeout: number | null = null): Promise<Answer<T>> {
        const opened = await this._waitForOpen();
        if (!opened) {
            const err = new Error(`WebSocket not connected for: ${eventName}`);
            this._handleError(err);
            throw err;
        }

        return new Promise<Answer<T>>((resolve, reject) => {
            const timeout = customTimeout || this.currentTimeout;
            this._resetTimeout();

            const callbackId = this._generateCallbackId();
            const message: WsOutgoingMessage = {
                type: "event",
                event: eventName,
                data: data,
                callbackId: callbackId,
                timestamp: Date.now()
            };

            const timeoutId = setTimeout(() => {
                if (this.callbacks.has(callbackId)) {
                    this.callbacks.delete(callbackId);
                    reject(new Error(`Ack timeout (${timeout}ms) for: ${eventName}`));
                }
            }, timeout);

            this.callbacks.set(callbackId, { resolve, reject, timeout: timeoutId, event: eventName });

            try {
                // invariant: сокет открыт — ждали его в _waitForOpen выше
                this.ws!.send(JSON.stringify(message));
                this.stats.messagesSent++;
                this.stats.acksSent++;
            } catch (error) {
                clearTimeout(timeoutId);
                this.callbacks.delete(callbackId);
                reject(error);
            }
        });
    }

    /**
     * Отправить событие без ожидания ответа (fire-and-forget).
     * @param {string} eventName - Имя события.
     * @param {unknown} [data] - Полезная нагрузка.
     * @returns {Promise<void>}
     */
    async emit(eventName: string, data?: unknown): Promise<void> {
        const opened = await this._waitForOpen();
        if (!opened) {
            Logger.warn(`[app][ws]: Prop "${eventName}" not sent: disconnected`);
            return;
        }
        try {
            // invariant: сокет открыт — ждали его в _waitForOpen выше
            this.ws!.send(JSON.stringify({ type: "event", event: eventName, data: data, timestamp: Date.now() }));
            this.stats.messagesSent++;
        } catch (error) {
            this._handleError(error, `Emit failed: ${eventName}`);
        }
    }

    _generateCallbackId(): string {
        return `cb::${Date.now()}::${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Учёт ошибки: счётчик, лог и внутреннее событие "error" подписчикам.
     * @param {unknown} error - Ошибка.
     * @param {string} [context=""] - Контекст для лога.
     */
    _handleError(error: unknown, context = ""): void {
        this.stats.errors++;

        // Сообщение ошибки: у Error и объектов с message берём его,
        // иначе приводим значение к строке
        const message = (typeof error === "object" && error !== null && "message" in error && error.message)
            ? String(error.message)
            : String(error);

        Logger.error("[app][ws]:", context, { msg: message });
        this._emitInternal("error", { error, context });
    }

    // ***************************************************************************
    // Подключение
    // ***************************************************************************
    /**
     * Подключиться (или вернуть уже идущее подключение — без гонок).
     * @returns {Promise<boolean|Event>} - true, если уже был открыт; иначе событие open.
     */
    async connect(): Promise<boolean | Event> {
        // Если уже подключены - ничего не делаем
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.isConnected = true;
            return true;
        }

        // Сериализация: если подключение уже в процессе - возвращаем тот же промис.
        // Это предотвращает гонки, когда reconnect-таймер и внешний код вызывают connect() одновременно
        // и создают два конкурирующих WebSocket.
        if (this._connectingPromise) return this._connectingPromise;

        // Флаг завершения промиса виден и снаружи executor'а: он нужен, чтобы
        // понять, завершился ли промис СИНХРОННО внутри конструктора
        let settled = false;

        const connecting = new Promise<Event>((resolve, reject) => {
            const timeoutMs = this.options.timeout;

            // Единая точка завершения промиса (только один раз)
            const settle = <T>(fn: (value: T) => void, value: T): void => {
                if (settled) return;
                settled = true;
                if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
                this._connectingPromise = null;
                fn(value);
            };

            try {
                Logger.debug("[app][ws]: Попытка подключения...");
                this.stats.connectionAttempts++;

                // Жесткая очистка предыдущего сокета
                this._destroySocket();

                // Абсолютный ws(s)-URL собирается явно: старые Chromium
                // (Electron 30 = Chromium 124) не принимают в WebSocket
                // относительные пути и http(s)-схему — поддержка появилась
                // только в Chromium 126+. Явный ws(s)-URL работает везде.
                const wsUrl = new URL(this.url, window.location.href);
                if (wsUrl.protocol === "https:") wsUrl.protocol = "wss:";
                else if (wsUrl.protocol === "http:") wsUrl.protocol = "ws:";

                this.ws = new WebSocket(wsUrl.toString());
                this._heartbeatMisses = 0;

                // Ссылка на текущий сокет, чтобы устаревший таймаут не закрывал новый сокет
                const wsRef = this.ws;

                this.connectionTimeout = setTimeout(() => {
                    if (this.ws === wsRef && this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        settle(reject, new Error("Connection timeout"));
                        try {
                            this.ws.close();
                        } catch {
                            // close() на закрывающемся сокете может бросить — соединение уже считается упавшим
                        }
                    }
                }, timeoutMs);

                this.ws.onopen = (event) => {
                    settle(resolve, event);
                    this.isConnected = true;
                    this.reconnectCount = 0; // Сброс только при реальном успехе
                    this._isReconnecting = false;
                    Logger.debug("[app][ws]: Подключено успешно");
                    this._emitInternal("connected", event);
                    this._startHeartbeat();
                };

                this.ws.onmessage = (event) => {
                    this._onMessageHandler(event);
                };

                this.ws.onerror = (e) => this._onError(e);

                this.ws.onclose = (event) => {
                    this._onCloseHandler(event);
                    // Если сокет закрылся, так и не открывшись — завершаем промис (раньше он висел вечно)
                    settle(reject, new Error(`Connection failed (close code ${event.code})`));
                };

            } catch (error) {
                settle(reject, error);
                this._handleError(error, "Socket creation failed");
            }
        });

        // Если промис завершился СИНХРОННО внутри executor'а (new WebSocket() бросает,
        // например на некорректном URL) — поле не заполняем: иначе следующий connect()
        // вернул бы уже отклонённый промис и авто-реконнект встал бы насовсем.
        if (!settled) this._connectingPromise = connecting;

        return connecting;
    }

    /**
     * ***************************************************************************
     * Обновить access-токен в URL сокета: следующий connect() (в том числе
     * авто-реконнект) пойдёт на handshake уже с новым токеном.
     * @param {string} token - Новый access-токен.
     * ***************************************************************************
     */
    setAccessToken(token: string): void {
        // URL хранится в относительном виде (путь + query) — меняем только параметр
        const url = new URL(this.url, window.location.href);
        url.searchParams.set("access_token", token);
        this.url = `${url.pathname}${url.search}`;
    }

    // Принудительное уничтожение текущего сокета без побочных эффектов
    _destroySocket(): void {
        if (this.ws) {
            const ws = this.ws;
            ws.onopen = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            try {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            } catch {
                // close() может бросить на уже закрытом соединении — игнорируем
            }
            this.ws = null;
        }
    }

    /**
     * Закрыть сокет без переподключения (авто-реконнект выключается).
     * @param {number} [code=1000] - Код закрытия.
     * @param {string} [reason="Normal closure"] - Причина закрытия.
     */
    disconnect(code = 1000, reason = "Normal closure"): void {
        this.options.autoReconnect = false;
        this._cancelReconnect();
        this._stopHeartbeat();
        this._isReconnecting = false;
        this._cleanup();
        this._destroySocket();
        this.isConnected = false;
        this._emitInternal("disconnected", { code, reason });
    }

    _cleanup(): void {
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
        for (const [id, cb] of this.callbacks) {
            clearTimeout(cb.timeout);
            cb.reject(new Error("Disconnected"));
        }
        this.callbacks.clear();
    }

    /**
     * Подписаться на событие (серверное или внутреннее: connected/disconnected/error/auth-expired/reconnect-limit).
     * @param {string} eventName - Имя события.
     * @param {SocketEventHandler} handler - Обработчик (может вернуть ответ для ack).
     */
    on(eventName: string, handler: SocketEventHandler): void {
        if (!this.eventHandlers.has(eventName)) this.eventHandlers.set(eventName, []);
        this.eventHandlers.get(eventName)?.push(handler);
    }

    /**
     * Отписаться от события: без обработчика — удалить подписку целиком,
     * с обработчиком — убрать только его.
     * @param {string} eventName - Имя события.
     * @param {SocketEventHandler|null} [handler=null] - Обработчик.
     */
    off(eventName: string, handler: SocketEventHandler | null = null): void {
        if (!handler) this.eventHandlers.delete(eventName);
        else {
            const hs = this.eventHandlers.get(eventName);
            if (hs) {
                const i = hs.indexOf(handler);
                if (i > -1) hs.splice(i, 1);
            }
        }
    }

    /**
     * Разослать внутреннее событие всем подписчикам: ошибка одного
     * обработчика не должна ронять остальных.
     * @param {string} eventName - Имя события.
     * @param {unknown} data - Полезная нагрузка.
     */
    _emitInternal(eventName: string, data: unknown): void {
        const hs = this.eventHandlers.get(eventName) || [];
        hs.forEach(h => {
            try {
                h(data);
            } catch {
                // Изоляция обработчиков: исключение подписчика не влияет на других
            }
        });
    }

    _onError(error: Event): void {
        this._handleError(error, "WebSocket Error");
    }

    _onCloseHandler(event: CloseEvent): void {
        // Игнорируем события от устаревших сокетов.
        // (event.target есть в браузерах; если его нет — не блокируем обработку)
        if (event && event.target && this.ws && event.target !== this.ws) return;

        this.isConnected = false;
        this._stopHeartbeat();
        this._cleanup();
        this._emitInternal("disconnected", { code: event.code, reason: event.reason });

        // 1008 — ошибка аутентификации: переподключаться со старым токеном бессмысленно.
        // Эмитим отдельное событие "auth-expired": приложение обновит токен
        // (см. forms/main/events/socket/auth) и запустит переподключение само.
        if (event.code === 1008) {
            this._emitInternal("auth-expired", { code: 1008, message: event.reason || "Authentication failed" });
            return;
        }

        // Если авто-реконнект включен и это не штатный выход
        if (this.options.autoReconnect) {
            this._attemptReconnect();
        }
    }

    _onMessageHandler(event: MessageEvent): void {
        // Любое сообщение от сервера — признак того, что соединение живо
        this._heartbeatMisses = 0;

        try {
            this.stats.messagesReceived++;
            const msg: unknown = JSON.parse(event.data);
            if (isWsIncomingMessage(msg)) {
                if (msg.type === "event") this._handleServerEvent(msg);
                else if (msg.type === "callback") this._handleCallback(msg);
                else if (msg.type === "error") this._handleServerError(msg);
            }
        } catch (e) {
            this._handleError(e, "Message parse error");
        }
    }

    /**
     * Обработать событие от сервера: раздать обработчикам и (если у конверта
     * есть callbackId) ответить первым результатом.
     * @param {WsEventMessage} message - Конверт события.
     */
    _handleServerEvent(message: WsEventMessage): void {
        const { event, data, callbackId, timestamp } = message;
        const handlers = this.eventHandlers.get(event) || [];
        let isAckSent = false;

        handlers.forEach(async (handler) => {
            try {
                const result = await handler(data, timestamp);
                if (callbackId && result !== undefined && !isAckSent) {
                    this._sendCallback(callbackId, null, result);
                    isAckSent = true;
                }
            } catch (error) {
                if (callbackId && !isAckSent) {
                    this._sendCallback(callbackId, formatErrorMessage(error), null);
                    isAckSent = true;
                }
            }
        });
    }

    /**
     * Завершить ожидающий запрос: ошибочный конверт → ApiError с полями
     * сервера (code/status/reason/details), иначе — resolve данными.
     * @param {WsCallbackMessage} message - Конверт ответа.
     */
    _handleCallback(message: WsCallbackMessage): void {
        const { callbackId, error, data } = message;
        const cb = this.callbacks.get(callbackId);
        if (cb) {
            clearTimeout(cb.timeout);
            this.callbacks.delete(callbackId);
            if (error || isFailedAnswer(data)) {

                // Сервер шлёт структурированную ошибку { message, code, status, reason }.
                // Раньше приходила
                // строка, поэтому код (ACCESS_DENIED, RATE_LIMIT_EXCEEDED, ...) и HTTP-статус
                // были недоступны и клиент матчил текст подстрокой.
                const source: unknown = (typeof error === "object" && error !== null) ? error : (data || {});
                const payload = toServerErrorPayload(source);

                cb.reject(new ApiError(payload.message || "Server Error", payload));
            } else cb.resolve(data);
            this.stats.acksReceived++;
        }
    }

    _handleServerError(message: WsErrorMessage): void {
        this._emitInternal("error", message.error);
    }

    /**
     * Ответить серверу на событие с callbackId.
     * @param {string} callbackId - Идентификатор колбэка.
     * @param {string|null} error - Текст ошибки обработчика (null — без ошибки).
     * @param {unknown} data - Результат обработчика.
     */
    _sendCallback(callbackId: string, error: string | null, data: unknown): void {
        if (!this._isReady()) return;

        const message: WsOutgoingCallback = {
            type: "callback",
            callbackId,
            error: error ? { message: error } : null,
            data
        };

        // invariant: сокет открыт — проверили через _isReady выше
        this.ws!.send(JSON.stringify(message));
    }

    // ***************************************************************************
    // Логика переподключения
    // ***************************************************************************
    _cancelReconnect(): void {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }

    _attemptReconnect(): void {
        // Если процесс уже запущен - игнорируем новые вызовы
        if (this._isReconnecting) return;

        // Уже подключены - нечего переподключать
        if (this._isReady()) return;

        // Проверка лимита: если исчерпали лимит — НЕ останавливаемся навсегда,
        // а переходим в режим редких попыток с максимальной задержкой.
        // Это важно: сервер может перезапускаться дольше, чем хватит бюджета попыток.
        const limit = this.options.reconnectAttempts;
        let slowMode = false;
        if (limit > 0 && this.reconnectCount >= limit) {
            slowMode = true;
            if (!this._limitNotified) {
                this._limitNotified = true;
                Logger.error("[app][ws]: Превышено количество попыток переподключения, продолжаю редкие попытки");
                this._emitInternal("reconnect-limit", { attempts: this.reconnectCount });
            }
        }

        this._isReconnecting = true;
        this.reconnectCount++;
        this.stats.reconnects++;

        const delay = slowMode
            ? this.options.maxReconnectDelay
            : Math.min(
                this.options.reconnectDelay * Math.pow(1.3, this.reconnectCount),
                this.options.maxReconnectDelay
            );

        Logger.debug(`[app][ws]: Реконнект #${this.reconnectCount} через ${Math.round(delay)}ms...`);

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            // КЛЮЧЕВОЙ МОМЕНТ: Сбрасываем флаг ПЕРЕД вызовом connect.
            // Если connect упадет, сработает onclose, который увидит флаг false и запустит новый цикл.
            this._isReconnecting = false;
            this.connect().catch(() => {
                // Ошибка уже обработана в onclose
            });
        }, delay);
    }

    // ***************************************************************************
    // Сердцебиение (heartbeat)
    // ***************************************************************************
    _startHeartbeat(): void {
        this._stopHeartbeat();
        if (!this.options.heartbeatEnabled) return;
        const interval = this.options.heartbeatInterval;
        if (!interval || interval <= 0) return;
        this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), interval);
    }

    _stopHeartbeat(): void {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    async _sendHeartbeat(): Promise<void> {
        if (!this._isReady() || !this.options.heartbeatEnabled) return;

        const alive = await this._ping(this.options.heartbeatTimeout);

        if (!alive) {
            this._heartbeatMisses++;
            // Несколько пропусков подряд — соединение "полумертвое"
            // (обычно onclose не приходит без RST/FIN). Рвём его принудительно.
            if (this._heartbeatMisses >= this.options.heartbeatMisses) {
                this._heartbeatMisses = 0;
                Logger.warn("[app][ws]: Сердцебиение не получило ответа — принудительное переподключение");
                this._forceReconnect();
            }
        }
    }

    // Пинг без пользовательских колбэков:
    // возвращает true при ЛЮБОМ ответе сервера (включая ответ с ошибкой — сервер жив),
    // false — если ответа не дождались или сокет уже закрыт.
    _ping(timeoutMs: number): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const ws = this.ws;
            if (!ws || !this._isReady() || ws !== this.ws) {
                resolve(false);
                return;
            }

            const callbackId = this._generateCallbackId();
            const message: WsOutgoingMessage = {
                type: "event",
                event: "[system]: ping",
                data: { t: Date.now() },
                callbackId: callbackId,
                timestamp: Date.now()
            };

            const timeoutId = setTimeout(() => {
                this.callbacks.delete(callbackId);
                resolve(false);
            }, timeoutMs);

            const cb: PendingCallback = {
                resolve: () => {
                    clearTimeout(timeoutId);
                    this.callbacks.delete(callbackId);
                    resolve(true);
                },
                reject: () => {
                    clearTimeout(timeoutId);
                    this.callbacks.delete(callbackId);
                    resolve(true);
                },
                timeout: timeoutId,
                event: message.event
            };

            // Регистрируем ДО отправки, чтобы ответ не потерялся
            this.callbacks.set(callbackId, cb);

            try {
                // invariant: сокет открыт — проверили через _isReady выше
                ws.send(JSON.stringify(message));
                this.stats.messagesSent++;
            } catch {
                // Сокет закрылся между проверкой и отправкой — пинг считается неудачным
                clearTimeout(timeoutId);
                this.callbacks.delete(callbackId);
                resolve(false);
            }
        });
    }

    _forceReconnect(): void {
        if (!this.options.autoReconnect) return;

        this._stopHeartbeat();
        this.isConnected = false;
        this._cleanup();
        this._destroySocket(); // onclose при этом подавлен, поэтому запускаем реконнект сами
        this._isReconnecting = false;
        this._emitInternal("disconnected", { code: 1006, reason: "Heartbeat timeout" });
        this._attemptReconnect();
    }

    /**
     * Счётчики диагностики + флаг соединения.
     * @returns {SocketStats & { isConnected: boolean }} - Снимок статистики.
     */
    getStats(): SocketStats & { isConnected: boolean } {
        return { ...this.stats, isConnected: this.isConnected };
    }
}
