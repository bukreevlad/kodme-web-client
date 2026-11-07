// Импортируем utils
import { Logger } from "../logs/logger.js";
import {
    decodeFrame,
    encodeControlFrame,
    encodeFileChunkFrame,
    FrameAssembler,
    splitFrame,
    type SecretControlMessage,
} from "./secret_frames.js";

/**
 * Состояние P2P-соединения секретного чата.
 */
export type SecretConnectionState = "new" | "connecting" | "connected" | "closed" | "failed";

/**
 * Локальный WebRTC-сигнал, который нужно отправить собеседнику через сервер.
 */
export interface SecretLocalSignal {
    /** Тип сигнала. */
    type: "offer" | "answer" | "candidate";
    /** SDP (для offer/answer). */
    sdp: string | null;
    /** ICE-candidate (JSON-строка). */
    candidate: string | null;
}

/**
 * Настройки соединения секретного чата.
 */
export interface SecretConnectionOptions {
    /** Id чата (AAD шифрования кадров). */
    chatId: string;
    /** Ключ сессии (AES-256-GCM). */
    sessionKey: CryptoKey;
    /** Роль offerer (устанавливает соединение) или answerer. */
    isOfferer: boolean;
    /** ICE-серверы (STUN/TURN). */
    iceServers: RTCIceServer[];
    /** Колбэк локального сигнала для отправки через сервер. */
    onLocalSignal: (signal: SecretLocalSignal) => void;
    /** Колбэк control-сообщения (может быть асинхронным: кадры ждут его завершения). */
    onControl: (control: SecretControlMessage) => void | Promise<void>;
    /** Колбэк чанка файла (может быть асинхронным: кадры ждут его завершения). */
    onFileChunk: (fileId: string, index: number, data: Uint8Array<ArrayBuffer>) => void | Promise<void>;
    /** Колбэк смены состояния. */
    onStateChange: (state: SecretConnectionState) => void;
}

// Период keep-alive пинга (мс)
const PING_INTERVAL = 20000;

// Тишина в канале дольше этого времени = соединение считается мёртвым (мс)
const IDLE_TIMEOUT = 45000;

// Пауза отправки чанков при переполнении буфера DataChannel (байт)
const MAX_BUFFERED_AMOUNT = 1024 * 1024;

// Шаг ожидания освобождения буфера DataChannel (мс)
const BUFFER_POLL_INTERVAL = 50;

/**
 * ***************************************************************************
 * SecretConnection - P2P-соединение секретного чата (WebRTC DataChannel).
 *
 * Управляет RTCPeerConnection + DataChannel «secret-chat»: обмен SDP/ICE
 * через колбэк onLocalSignal (доставка — через сервер), шифрование кадров
 * ключом сессии, keep-alive ping/pong, отправка control-сообщений и чанков
 * файлов. Весь контент ходит только между устройствами.
 * ***************************************************************************
 */
export class SecretConnection {

    /** Опции соединения. */
    private readonly options: SecretConnectionOptions;

    /** WebRTC-соединение. */
    private pc: RTCPeerConnection | null = null;

    /** Канал данных. */
    private dc: RTCDataChannel | null = null;

    /** Счётчик исходящих control-кадров (часть nonce). */
    private counter = 0;

    /** Время последнего входящего кадра (keep-alive). */
    private lastActivityAt = Date.now();

    /** Таймер keep-alive. */
    private pingTimer: ReturnType<typeof setInterval> | null = null;

    /** Очередь обработки входящих сигналов (защита от гонки offer/answer). */
    private signalQueue: Promise<void> = Promise.resolve();

    /** ICE-candidate, пришедшие раньше remote description. */
    private pendingCandidates: RTCIceCandidateInit[] = [];

    /** Очередь обработки входящих кадров (кадры разбираются строго по очереди). */
    private inboxQueue: Promise<void> = Promise.resolve();

    /** Сборщик кадров, пришедших частями (дробление под лимит сообщения канала). */
    private assembler = new FrameAssembler();

    /**
     * ***************************************************************************
     * Конструктор соединения.
     * @param {SecretConnectionOptions} options - Настройки соединения.
     * ***************************************************************************
     */
    constructor(options: SecretConnectionOptions) {
        this.options = options;
    }

    /**
     * ***************************************************************************
     * Запуск соединения: offerer создаёт канал данных и отправляет offer,
     * answerer ждёт offer от собеседника (handleSignal).
     * ***************************************************************************
     */
    async start(): Promise<void> {

        // Создаём WebRTC-соединение
        this._createPeerConnection();

        // Роль offerer: создаём канал данных и отправляем offer
        if (this.options.isOfferer && this.pc) {
            const channel = this.pc.createDataChannel("secret-chat", { ordered: true });
            this._attachChannel(channel);
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.options.onLocalSignal({ type: "offer", sdp: offer.sdp ?? null, candidate: null });
        }

    }

    /**
     * ***************************************************************************
     * Приём входящего WebRTC-сигнала от собеседника (через сервер).
     *
     * Сигналы обрабатываются строго по очереди: параллельная обработка двух
     * offer/answer выносила ошибку WebRTC «Cannot set a local answer in 0».
     * @param {"offer" | "answer" | "candidate"} type - Тип сигнала.
     * @param {string | null} sdp - SDP (для offer/answer).
     * @param {string | null} candidate - ICE-candidate (JSON-строка).
     * ***************************************************************************
     */
    async handleSignal(type: "offer" | "answer" | "candidate", sdp: string | null, candidate: string | null): Promise<void> {

        const task = this.signalQueue
            .catch(() => undefined)
            .then(() => this._processSignal(type, sdp, candidate));

        // Очередь не должна застревать после ошибки одного из сигналов
        this.signalQueue = task.then(() => undefined, () => undefined);
        return task;

    }

    /**
     * ***************************************************************************
     * Обработка одного входящего сигнала (вызывается из очереди handleSignal).
     * @param {"offer" | "answer" | "candidate"} type - Тип сигнала.
     * @param {string | null} sdp - SDP (для offer/answer).
     * @param {string | null} candidate - ICE-candidate (JSON-строка).
     * ***************************************************************************
     */
    private async _processSignal(type: "offer" | "answer" | "candidate", sdp: string | null, candidate: string | null): Promise<void> {

        const pc = this.pc ?? this._createPeerConnection();

        // ---------- OFFER / ANSWER ----------
        if (type === "offer" || type === "answer") {
            if (!sdp) throw new Error("Не передан SDP");

            // Уже обработанный SDP (ретрансляция) — игнорируем
            if (pc.remoteDescription?.sdp === sdp) return;

            // Устаревшие сигналы прошлых попыток соединения игнорируем:
            // offer принимаем только в стабильном состоянии, answer — только
            // на наш отправленный offer
            if (type === "offer" && pc.signalingState !== "stable") return;
            if (type === "answer" && pc.signalingState !== "have-local-offer") return;

            await pc.setRemoteDescription({ type, sdp });

            // Принимаем накопленные ICE-candidate, пришедшие раньше SDP
            await this._flushPendingCandidates(pc);

            // На offer отвечаем answer'ом
            if (type === "offer") {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this.options.onLocalSignal({ type: "answer", sdp: answer.sdp ?? null, candidate: null });
            }
            return;
        }

        // ---------- CANDIDATE ----------
        if (!candidate) throw new Error("Не передан ICE-candidate");
        const init = toIceCandidateInit(JSON.parse(candidate));

        // Remote description ещё не установлен — candidate копим до него
        if (!pc.remoteDescription) {
            this.pendingCandidates.push(init);
            return;
        }

        await pc.addIceCandidate(init);

    }

    /**
     * ***************************************************************************
     * Приём ICE-candidate, накопленных до установки remote description.
     * @param {RTCPeerConnection} pc - Соединение.
     * ***************************************************************************
     */
    private async _flushPendingCandidates(pc: RTCPeerConnection): Promise<void> {

        const candidates = this.pendingCandidates;
        this.pendingCandidates = [];
        for (const init of candidates) {
            await pc.addIceCandidate(init);
        }

    }

    /**
     * ***************************************************************************
     * Отправка control-сообщения.
     * @param {SecretControlMessage} control - Control-сообщение.
     * ***************************************************************************
     */
    async sendControl(control: SecretControlMessage): Promise<void> {
        const frame = await encodeControlFrame(this.options.sessionKey, this.options.chatId, this.counter++, control);
        this._send(frame);
    }

    /**
     * ***************************************************************************
     * Отправка чанка файла (с ожиданием освобождения буфера канала).
     * @param {string} fileId - Id файла (UUIDv7).
     * @param {number} index - Порядковый номер чанка.
     * @param {Uint8Array} data - Открытые байты чанка.
     * ***************************************************************************
     */
    async sendFileChunk(fileId: string, index: number, data: Uint8Array<ArrayBuffer>): Promise<void> {
        await this._waitForBuffer();
        const frame = await encodeFileChunkFrame(this.options.sessionKey, this.options.chatId, fileId, index, data);
        this._send(frame);
    }

    /**
     * ***************************************************************************
     * Закрытие соединения.
     * ***************************************************************************
     */
    close(): void {

        // Останавливаем keep-alive
        this._stopKeepAlive();

        // Закрываем канал и соединение
        this.dc?.close();
        this.pc?.close();
        this.dc = null;
        this.pc = null;
        this.pendingCandidates = [];
        this._setState("closed");

    }

    /**
     * ***************************************************************************
     * Создание и настройка WebRTC-соединения.
     * @returns {RTCPeerConnection} - Соединение.
     * ***************************************************************************
     */
    private _createPeerConnection(): RTCPeerConnection {

        const pc = new RTCPeerConnection({ iceServers: this.options.iceServers });
        this.pc = pc;
        this._setState("connecting");

        // Локальные ICE-candidate'ы уходят собеседнику через сервер
        pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            this.options.onLocalSignal({
                type: "candidate",
                sdp: null,
                candidate: JSON.stringify(event.candidate.toJSON()),
            });
        };

        // Роль answerer: канал данных приходит от собеседника
        pc.ondatachannel = (event) => {
            this._attachChannel(event.channel);
        };

        // Обрыв соединения (ICE state)
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed") this._setState("failed");
        };

        return pc;

    }

    /**
     * ***************************************************************************
     * Подключение обработчиков канала данных.
     * @param {RTCDataChannel} channel - Канал данных.
     * ***************************************************************************
     */
    private _attachChannel(channel: RTCDataChannel): void {

        this.dc = channel;
        channel.binaryType = "arraybuffer";

        // Канал открыт: соединение установлено, запускаем keep-alive
        channel.onopen = () => {
            this.lastActivityAt = Date.now();
            this._setState("connected");
            this._stopKeepAlive();
            this.pingTimer = setInterval(() => this._keepAlive(), PING_INTERVAL);
        };

        // Входящие кадры: обрабатываются строго по очереди — параллельный
        // decodeFrame выстраивал лёгкий file_done впереди тяжёлых чанков,
        // и файл у получателя собирался с дырами
        channel.onmessage = (event) => {
            this.inboxQueue = this.inboxQueue
                .then(() => this._onMessage(event.data))
                .catch((error) => {
                    Logger.error("[app][SecretConnection]: ошибка обработки кадра:", error);
                });
        };

        // Канал закрыт: гасим keep-alive (иначе таймер продолжал слать ping
        // в закрытый канал и сыпал ошибками)
        channel.onclose = () => {
            this._stopKeepAlive();
            this._setState("closed");
        };

    }

    /**
     * ***************************************************************************
     * Обработка входящих данных канала.
     * @param {string | ArrayBuffer | Blob} data - Данные сообщения канала.
     * ***************************************************************************
     */
    private async _onMessage(data: string | ArrayBuffer | Blob): Promise<void> {

        // Бинарные кадры ожидаем как ArrayBuffer
        if (!(data instanceof ArrayBuffer)) throw new Error("Неожиданный формат кадра");
        this.lastActivityAt = Date.now();

        // Часть большого кадра: досылаем сборщику, обрабатываем только полный
        const assembled = this.assembler.push(new Uint8Array(data));
        if (!assembled) return;

        const frame = await decodeFrame(this.options.sessionKey, this.options.chatId, assembled);

        // Control-кадр: keep-alive обрабатываем сами, остальное — колбэку
        if (frame.kind === "control") {
            if (frame.control.type === "ping") {
                await this.sendControl({ type: "pong" });
                return;
            }
            if (frame.control.type === "pong") return;
            await this.options.onControl(frame.control);
            return;
        }

        // Кадр чанка файла
        await this.options.onFileChunk(frame.fileId, frame.index, frame.data);

    }

    /**
     * ***************************************************************************
     * Keep-alive: периодический пинг и контроль тишины в канале.
     * ***************************************************************************
     */
    private _keepAlive(): void {

        // Канал уже не открыт — keep-alive больше не нужен
        const dc = this.dc;
        if (!dc || dc.readyState !== "open") {
            this._stopKeepAlive();
            return;
        }

        // Тишина дольше таймаута = соединение мёртвым
        if (Date.now() - this.lastActivityAt > IDLE_TIMEOUT) {
            Logger.warn("[app][SecretConnection]: keep-alive без ответа, закрываем соединение");
            this.close();
            this._setState("failed");
            return;
        }

        // Отправляем пинг
        this.sendControl({ type: "ping" }).catch((error) => {
            Logger.error("[app][SecretConnection]: ошибка отправки ping:", error);
        });

    }

    /**
     * ***************************************************************************
     * Остановка keep-alive таймера.
     * ***************************************************************************
     */
    private _stopKeepAlive(): void {

        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }

    }

    /**
     * ***************************************************************************
     * Отправка готового кадра в канал (кадры крупнее лимита сообщения канала
     * уходят частями; dc.send() синхронен — части уходят одним куском кода и
     * соседние отправки не вклиниваются между ними).
     * @param {Uint8Array} frame - Кадр.
     * ***************************************************************************
     */
    private _send(frame: Uint8Array<ArrayBuffer>): void {
        const dc = this.dc;
        if (!dc || dc.readyState !== "open") throw new Error("Канал данных не открыт");
        for (const part of splitFrame(frame)) {
            dc.send(part);
        }
    }

    /**
     * ***************************************************************************
     * Ожидание освобождения буфера канала перед отправкой чанка.
     * ***************************************************************************
     */
    private async _waitForBuffer(): Promise<void> {

        const dc = this.dc;
        if (!dc || dc.readyState !== "open") throw new Error("Канал данных не открыт");

        // Ждём, пока буфер не освободится (канал при этом мог закрыться)
        while (dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
            if (dc.readyState !== "open") throw new Error("Канал данных закрыт");
            await new Promise((resolve) => setTimeout(resolve, BUFFER_POLL_INTERVAL));
        }

    }

    /**
     * ***************************************************************************
     * Смена состояния соединения (с колбэком наружу).
     * @param {SecretConnectionState} state - Новое состояние.
     * ***************************************************************************
     */
    private _setState(state: SecretConnectionState): void {
        Logger.debug(`[app][SecretConnection][${this.options.chatId}]: состояние → ${state}`);
        this.options.onStateChange(state);
    }

}

/**
 * Преобразование разобранного JSON в параметры ICE-candidate.
 * @param {unknown} value - Значение из JSON.
 * @returns {RTCIceCandidateInit} - Параметры candidate.
 */
function toIceCandidateInit(value: unknown): RTCIceCandidateInit {

    if (typeof value !== "object" || value === null) throw new Error("Некорректный ICE-candidate");
    const candidate = "candidate" in value ? value.candidate : undefined;
    if (typeof candidate !== "string") throw new Error("Некорректный ICE-candidate");

    const init: RTCIceCandidateInit = { candidate };

    // Необязательные поля candidate
    if ("sdpMid" in value && typeof value.sdpMid === "string") init.sdpMid = value.sdpMid;
    if ("sdpMLineIndex" in value && typeof value.sdpMLineIndex === "number") init.sdpMLineIndex = value.sdpMLineIndex;
    return init;

}
