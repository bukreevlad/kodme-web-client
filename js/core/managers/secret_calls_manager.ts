// Импортируем config
import { Socket } from "../../config/socket.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { genUuidv7 } from "../../utils/crypto/gen_uuidv7.js";
import { signalRequest } from "../../utils/secret_calls/secret_calls_requests.js";
import { presenceSubscribeRequest } from "../../utils/secret_chats/secret_chats_requests.js";

/**
 * Состояние секретного звонка.
 */
export type SecretCallState = "calling" | "incoming" | "connecting" | "connected" | "reconnecting" | "ended";

/**
 * Причина завершения звонка.
 */
export type SecretCallEndReason = "hangup" | "declined" | "no_answer" | "taken" | "failed";

/**
 * События SecretCallsManager для UI.
 */
export interface SecretCallsManagerEvents {
    /** Входящий звонок (звонят на все онлайн-устройства). */
    "call::incoming": { callId: string; peerUserId: string };
    /** Состояние звонка изменилось. */
    "call::state": { callId: string; state: SecretCallState };
    /** Локальный медиапоток готов (микрофон/камера). */
    "call::local-stream": { callId: string; stream: MediaStream };
    /** Удалённый медиапоток обновился (дорожки собеседника). */
    "call::remote-stream": { callId: string; stream: MediaStream };
    /** Звонок завершён. */
    "call::ended": { callId: string; reason: SecretCallEndReason };
}

/** Обработчик события менеджера. */
type SecretCallsEventHandler<K extends keyof SecretCallsManagerEvents> = (payload: SecretCallsManagerEvents[K]) => void;

/** Обработчик события с типом нагрузки, стёртым до unknown (внутреннее хранилище). */
type SecretCallsAnyHandler = (payload: unknown) => void;

// Звонок в работе: сигналинг, медиа и состояние
interface CallSession {
    /** Id звонка (UUIDv7, живёт в сигналинге как chat_id). */
    callId: string;
    /** Id собеседника. */
    peerUserId: string;
    /** Устройства собеседника, которым отправлен вызов (исходящий). */
    ringedDeviceIds: string[];
    /** Устройства собеседника, ответившие отказом (исходящий). */
    declinedDeviceIds: Set<string>;
    /** Устройство собеседника на линии (после ответа). */
    peerDeviceId: string | null;
    /** WebRTC-соединение звонка (отдельное от секретных чатов). */
    pc: RTCPeerConnection | null;
    /** Локальный поток (микрофон/камера). */
    localStream: MediaStream | null;
    /** Удалённый поток (дорожки собеседника). */
    remoteStream: MediaStream;
    /** Сохранённый offer входящего звонка (до принятия). */
    pendingOffer: string | null;
    /** Исходящий звонок. */
    isOutgoing: boolean;
    /** Текущее состояние. */
    state: SecretCallState;
    /** Камера: направление (для переключения). */
    facingMode: "user" | "environment";
    /** Таймер ожидания ответа (исходящий). */
    answerTimer: ReturnType<typeof setTimeout> | null;
}

// Таймаут прозвона без ответа (мс)
const CALL_ANSWER_TIMEOUT = 45000;

/**
 * ***************************************************************************
 * SecretCallsManager - менеджер секретных звонков (WebRTC P2P, 1 на 1).
 *
 * Звонок независим от секретных чатов: свой домен сигналинга
 * (`[secret-call]: signal`, call_id — свой UUIDv7) и отдельный
 * RTCPeerConnection с медиа-дорожками. Медиа шифруется DTLS-SRTP
 * (стандарт WebRTC). Звонок звонит на все онлайн-устройства собеседника:
 * отвечает то, которое приняли, остальным уходит hangup.
 * ***************************************************************************
 */
export class SecretCallsManager {

    /** Экземпляр менеджера уровня сессии. */
    static instance: SecretCallsManager | null = null;

    /** Звонки по id (в v1 одновременно живёт один). */
    private readonly calls = new Map<string, CallSession>();

    /** Текущий звонок (исходящий или принятый). */
    private current: CallSession | null = null;

    /** Обработчики событий для UI. */
    private readonly handlers = new Map<keyof SecretCallsManagerEvents, Set<SecretCallsAnyHandler>>();

    /**
     * ***************************************************************************
     * Создание и запуск менеджера (подписка на события сигналинга).
     * @returns {SecretCallsManager} - Экземпляр менеджера.
     * ***************************************************************************
     */
    static initial(): SecretCallsManager {

        if (this.instance) return this.instance;

        const manager = new SecretCallsManager();
        this.instance = manager;
        Socket.client.on("[secret-call]: signal", manager._onSignal);
        return manager;

    }

    /**
     * ***************************************************************************
     * Остановка менеджера: завершение звонков, отписка от событий.
     * ***************************************************************************
     */
    static destroy(): void {

        const manager = this.instance;
        if (!manager) return;

        Socket.client.off("[secret-call]: signal", manager._onSignal);
        for (const session of manager.calls.values()) {
            manager._teardown(session, "hangup");
        }
        manager.calls.clear();
        manager.current = null;
        manager.handlers.clear();
        this.instance = null;

    }

    /**
     * ***************************************************************************
     * Подписка на событие менеджера.
     * @param {keyof SecretCallsManagerEvents} event - Имя события.
     * @param {Function} handler - Обработчик.
     * @returns {Function} - Функция отписки.
     * ***************************************************************************
     */
    on<K extends keyof SecretCallsManagerEvents>(event: K, handler: SecretCallsEventHandler<K>): () => void {

        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }

        // Обёртка стирает тип нагрузки для внутреннего хранилища
        // invariant: payload всегда формируется в _emit с типом события K
        const wrapped: SecretCallsAnyHandler = (payload) => handler(payload as SecretCallsManagerEvents[K]);
        set.add(wrapped);
        return () => {
            set.delete(wrapped);
        };

    }

    // ===========================================================================
    // Публичное API (используется формами звонка)
    // ===========================================================================

    /**
     * ***************************************************************************
     * Начать исходящий звонок: вызов уходит всем онлайн-устройствам
     * собеседника, ответившее устройство получает соединение.
     * @param {string} peerUserId - Id собеседника.
     * @returns {Promise<string | null>} - Id звонка либо null (собеседник офлайн).
     * ***************************************************************************
     */
    async startCall(peerUserId: string): Promise<string | null> {

        // Параллельно второй звонок не поднимаем
        if (this.current) throw new Error("Звонок уже идёт");

        // Устройства собеседника (presence виден только контактам)
        const response = await presenceSubscribeRequest(peerUserId);
        const devices = response.data?.devices ?? [];
        if (devices.length === 0) return null;

        // Собеседник уже на линии параллельно: второго звонка не будет —
        // это обнаружится по его hangup на наш offer

        const callId = genUuidv7();
        const session: CallSession = {
            callId,
            peerUserId,
            ringedDeviceIds: devices,
            declinedDeviceIds: new Set(),
            peerDeviceId: null,
            pc: null,
            localStream: null,
            remoteStream: new MediaStream(),
            pendingOffer: null,
            isOutgoing: true,
            state: "calling",
            facingMode: "user",
            answerTimer: null,
        };
        this.calls.set(callId, session);
        this.current = session;

        try {

            // Локальные дорожки (микрофон/камера) — сразу, чтобы видеть себя
            await this._openLocalStream(session);

            // Offer уходит каждому онлайн-устройству собеседника
            const pc = this._createPeerConnection(session);
            this._attachLocalTracks(session, pc);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            for (const deviceId of devices) {
                this._sendSignal(session, deviceId, "offer", offer.sdp ?? null).catch((error) => {
                    Logger.debug("[app][SecretCallsManager]: устройство не получило вызов:", error);
                });
            }

            // Прозвон без ответа
            session.answerTimer = setTimeout(() => {
                this._teardown(session, "no_answer");
            }, CALL_ANSWER_TIMEOUT);

            this._setState(session, "calling");
            return callId;

        } catch (error) {

            this._teardown(session, "failed");
            throw error;

        }

    }

    /**
     * ***************************************************************************
     * Принять входящий звонок: локальные дорожки, ответ на offer собеседника.
     * @param {string} callId - Id звонка.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async acceptCall(callId: string): Promise<void> {

        const session = this.calls.get(callId);
        if (!session || session.state !== "incoming" || !session.pendingOffer) return;

        // Уже идёт другой звонок — занято
        if (this.current && this.current !== session) {
            this._hangupPeer(session);
            this._teardown(session, "taken");
            return;
        }

        try {

            await this._openLocalStream(session);

            const pc = this._createPeerConnection(session);
            this._attachLocalTracks(session, pc);
            await pc.setRemoteDescription({ type: "offer", sdp: session.pendingOffer });
            session.pendingOffer = null;

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this._sendSignal(session, session.peerDeviceId ?? "", "answer", answer.sdp ?? null);

            this.current = session;
            this._setState(session, "connecting");

        } catch (error) {

            Logger.error("[app][SecretCallsManager]: ошибка принятия звонка:", error);
            this._teardown(session, "failed");
            throw error;

        }

    }

    /**
     * ***************************************************************************
     * Отклонить входящий звонок (уходит hangup звонящему).
     * @param {string} callId - Id звонка.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async declineCall(callId: string): Promise<void> {

        const session = this.calls.get(callId);
        if (!session) return;
        this._hangupPeer(session);
        this._teardown(session, "declined");

    }

    /**
     * ***************************************************************************
     * Завершить текущий звонок (hangup собеседнику/устройствам).
     * @returns {void}
     * ***************************************************************************
     */
    hangup(): void {

        const session = this.current;
        if (!session) return;
        this._hangupPeer(session);
        this._teardown(session, "hangup");

    }

    /**
     * ***************************************************************************
     * Снимок звонка для формы: состояние и медиапотоки (события могли
     * прийти раньше открытия формы).
     * @param {string} callId - Id звонка.
     * @returns {object | null} - Снимок либо null (звонка нет).
     * ***************************************************************************
     */
    getSnapshot(callId: string): {
        peerUserId: string;
        isOutgoing: boolean;
        state: SecretCallState;
        localStream: MediaStream | null;
        remoteStream: MediaStream;
    } | null {

        const session = this.calls.get(callId);
        if (!session) return null;

        return {
            peerUserId: session.peerUserId,
            isOutgoing: session.isOutgoing,
            state: session.state,
            localStream: session.localStream,
            remoteStream: session.remoteStream,
        };

    }

    /**
     * ***************************************************************************
     * Переключение микрофона.
     * @returns {boolean} - Новое состояние (true — включён).
     * ***************************************************************************
     */
    toggleAudio(): boolean {

        const track = this.current?.localStream?.getAudioTracks()[0];
        if (!track) return false;
        track.enabled = !track.enabled;
        return track.enabled;

    }

    /**
     * ***************************************************************************
     * Переключение камеры.
     * @returns {boolean} - Новое состояние (true — включена).
     * ***************************************************************************
     */
    toggleVideo(): boolean {

        const track = this.current?.localStream?.getVideoTracks()[0];
        if (!track) return false;
        track.enabled = !track.enabled;
        return track.enabled;

    }

    /**
     * ***************************************************************************
     * Переключение камеры (передняя/задняя) с заменой дорожки в соединении.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async switchCamera(): Promise<void> {

        const session = this.current;
        if (!session || !session.pc) return;

        const facingMode = session.facingMode === "user" ? "environment" : "user";
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });

        // Заменяем видео-дорожку в отправителях соединения
        const newTrack = stream.getVideoTracks()[0];
        const sender = session.pc.getSenders().find((item) => item.track?.kind === "video");
        if (newTrack && sender) await sender.replaceTrack(newTrack);

        // Освобождаем прежнюю дорожку и обновляем локальный поток
        for (const track of session.localStream?.getVideoTracks() ?? []) {
            track.stop();
            session.localStream?.removeTrack(track);
        }
        if (newTrack && session.localStream) session.localStream.addTrack(newTrack);
        session.facingMode = facingMode;

        this._emit("call::local-stream", { callId: session.callId, stream: session.localStream ?? stream });

    }

    // ===========================================================================
    // Сигналинг
    // ===========================================================================

    /**
     * ***************************************************************************
     * Обработчик "[secret-call]: signal" — сигналы звонка (свой домен
     * событий, отдельный от секретных чатов).
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onSignal = (data: unknown): void => {
        this._handleSignal(data).catch((error) => {
            Logger.error("[app][SecretCallsManager]: ошибка обработки сигнала:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработка сигнала звонка: домен `[secret-call]` несёт только сигналы
     * звонков, поэтому offer — это всегда входящий вызов.
     * @param {unknown} data - Нагрузка события.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    private async _handleSignal(data: unknown): Promise<void> {

        if (!isSignalPayload(data)) return;
        const session = this.calls.get(data.call_id);

        // Не наш звонок
        if (!session) {

            // Входящим считаем только offer с SDP
            if (data.type !== "offer" || !data.sdp) return;

            // Уже идёт другой звонок — сразу занято
            if (this.current) {
                const busy: CallSession = {
                    callId: data.call_id,
                    peerUserId: data.from_user_id,
                    ringedDeviceIds: [],
                    declinedDeviceIds: new Set(),
                    peerDeviceId: data.from_device_id,
                    pc: null,
                    localStream: null,
                    remoteStream: new MediaStream(),
                    pendingOffer: null,
                    isOutgoing: false,
                    state: "incoming",
                    facingMode: "user",
                    answerTimer: null,
                };
                this._hangupPeer(busy);
                return;
            }

            // Входящий звонок: сохраняем offer до принятия
            const incoming: CallSession = {
                callId: data.call_id,
                peerUserId: data.from_user_id,
                ringedDeviceIds: [],
                declinedDeviceIds: new Set(),
                peerDeviceId: data.from_device_id,
                pc: null,
                localStream: null,
                remoteStream: new MediaStream(),
                pendingOffer: data.sdp,
                isOutgoing: false,
                state: "incoming",
                facingMode: "user",
                answerTimer: null,
            };
            this.calls.set(incoming.callId, incoming);
            this._emit("call::incoming", { callId: incoming.callId, peerUserId: incoming.peerUserId });
            return;

        }

        switch (data.type) {

            // Ответ на наш вызов: соединение принявшиего устройства
            case "answer": {
                if (!session.pc || !data.sdp || session.peerDeviceId) return;
                await session.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
                session.peerDeviceId = data.from_device_id;

                // Остальным устройствам собеседника вызов больше не нужен
                for (const deviceId of session.ringedDeviceIds) {
                    if (deviceId === session.peerDeviceId) continue;
                    this._sendSignal(session, deviceId, "hangup", null).catch(() => undefined);
                }
                if (session.answerTimer) {
                    clearTimeout(session.answerTimer);
                    session.answerTimer = null;
                }
                this._setState(session, "connecting");
                return;
            }

            // ICE-candidate собеседника
            case "candidate": {
                if (!session.pc || !data.candidate) return;
                try {
                    await session.pc.addIceCandidate(toIceCandidateInit(JSON.parse(data.candidate)));
                } catch (error) {
                    Logger.debug("[app][SecretCallsManager]: candidate не применился:", error);
                }
                return;
            }

            // Завершение/отказ собеседника
            case "hangup": {

                // Отказ одного из вызываемых устройств (до ответа)
                if (session.isOutgoing && !session.peerDeviceId) {
                    session.declinedDeviceIds.add(data.from_device_id);
                    if (session.declinedDeviceIds.size >= session.ringedDeviceIds.length) {
                        this._teardown(session, "declined");
                    }
                    return;
                }

                // Завершение разговора или занятость (другое устройство ответило)
                this._teardown(session, session.state === "connected" || session.state === "connecting" ? "hangup" : "taken");
                return;
            }

            default:
                return;

        }

    }

    /**
     * ***************************************************************************
     * Отправка сигнала собеседнику через сервер (доставка best-effort).
     * @param {CallSession} session - Звонок.
     * @param {string} deviceId - Устройство-получатель.
     * @param {"offer" | "answer" | "candidate" | "hangup"} type - Тип сигнала.
     * @param {string | null} sdp - SDP (для offer/answer).
     * @param {string | null} [candidate] - ICE-candidate (JSON-строка).
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    private _sendSignal(
        session: CallSession,
        deviceId: string,
        type: "offer" | "answer" | "candidate" | "hangup",
        sdp: string | null,
        candidate: string | null = null,
    ): Promise<unknown> {

        return signalRequest({
            call_id: session.callId,
            target_device_id: deviceId,
            type: type,
            sdp: sdp,
            candidate: candidate,
        });

    }

    /**
     * ***************************************************************************
     * Hangup собеседнику/устройствам: исходящий — всем вызываемым,
     * входящий — звонящему устройству.
     * @param {CallSession} session - Звонок.
     * @returns {void}
     * ***************************************************************************
     */
    private _hangupPeer(session: CallSession): void {

        const targets = session.isOutgoing ? session.ringedDeviceIds : [session.peerDeviceId ?? ""];
        for (const deviceId of targets) {
            if (!deviceId) continue;
            this._sendSignal(session, deviceId, "hangup", null).catch(() => undefined);
        }

    }

    // ===========================================================================
    // Медиа и соединение
    // ===========================================================================

    /**
     * ***************************************************************************
     * Открытие локального медиапотока (микрофон + камера).
     * @param {CallSession} session - Звонок.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    private async _openLocalStream(session: CallSession): Promise<void> {

        session.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            },
            video: {
                facingMode: session.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        });

        this._emit("call::local-stream", { callId: session.callId, stream: session.localStream });

    }

    /**
     * ***************************************************************************
     * Дорожки локального потока в соединение: без них offer/answer не несут
     * медиа-строк и собеседник не слышит и не видит звонящего.
     * @param {CallSession} session - Звонок.
     * @param {RTCPeerConnection} pc - Соединение звонка.
     * @returns {void}
     * ***************************************************************************
     */
    private _attachLocalTracks(session: CallSession, pc: RTCPeerConnection): void {

        const localStream = session.localStream;
        if (!localStream) return;
        for (const track of localStream.getTracks()) {
            pc.addTrack(track, localStream);
        }

    }

    /**
     * ***************************************************************************
     * Создание и настройка WebRTC-соединения звонка (медиа поверх DTLS-SRTP).
     * @param {CallSession} session - Звонок.
     * @returns {RTCPeerConnection} - Соединение.
     * ***************************************************************************
     */
    private _createPeerConnection(session: CallSession): RTCPeerConnection {

        const pc = new RTCPeerConnection({ iceServers: getIceServers() });
        session.pc = pc;

        // Локальные ICE-candidate'ы уходят собеседнику через сервер:
        // до ответа — всем вызываемым устройствам, после — активному
        pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            const targets = session.peerDeviceId ? [session.peerDeviceId] : session.ringedDeviceIds;
            for (const deviceId of targets) {
                this._sendSignal(session, deviceId, "candidate", null, JSON.stringify(event.candidate.toJSON())).catch(() => undefined);
            }
        };

        // Дорожки собеседника копим в одном потоке (форма слушает событие)
        pc.ontrack = (event) => {
            const stream = event.streams[0];
            const tracks = stream ? stream.getTracks() : [event.track];
            for (const track of tracks) {
                if (!session.remoteStream.getTracks().includes(track)) session.remoteStream.addTrack(track);
            }
            this._emit("call::remote-stream", { callId: session.callId, stream: session.remoteStream });
        };

        // Состояние соединения: разговор, обрыв, потеря
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") this._setState(session, "connected");
            if (pc.connectionState === "disconnected") this._setState(session, "reconnecting");
            if (pc.connectionState === "failed") this._teardown(session, "failed");
        };

        return pc;

    }

    // ===========================================================================
    // Состояние и завершение
    // ===========================================================================

    /**
     * ***************************************************************************
     * Смена состояния звонка (событие для UI).
     * @param {CallSession} session - Звонок.
     * @param {SecretCallState} state - Новое состояние.
     * @returns {void}
     * ***************************************************************************
     */
    private _setState(session: CallSession, state: SecretCallState): void {
        session.state = state;
        this._emit("call::state", { callId: session.callId, state });
    }

    /**
     * ***************************************************************************
     * Завершение звонка: остановка медиа, закрытие соединения, событие UI.
     * @param {CallSession} session - Звонок.
     * @param {SecretCallEndReason} reason - Причина завершения.
     * @returns {void}
     * ***************************************************************************
     */
    private _teardown(session: CallSession, reason: SecretCallEndReason): void {

        if (session.answerTimer) clearTimeout(session.answerTimer);
        session.answerTimer = null;

        session.pc?.close();
        session.pc = null;

        for (const track of session.localStream?.getTracks() ?? []) track.stop();
        session.localStream = null;

        this.calls.delete(session.callId);
        if (this.current === session) this.current = null;
        session.state = "ended";

        this._emit("call::ended", { callId: session.callId, reason });
        this._emit("call::state", { callId: session.callId, state: "ended" });

    }

    /**
     * ***************************************************************************
     * Рассылка события менеджера подписчикам (UI).
     * @param {keyof SecretCallsManagerEvents} event - Имя события.
     * @param {object} payload - Нагрузка события.
     * @returns {void}
     * ***************************************************************************
     */
    private _emit<K extends keyof SecretCallsManagerEvents>(event: K, payload: SecretCallsManagerEvents[K]): void {
        const set = this.handlers.get(event);
        if (!set) return;
        for (const handler of set) {
            handler(payload);
        }
    }

}

// ===========================================================================
// Разбор внешних нагрузок событий сокета (unknown → проверки)
// ===========================================================================

/**
 * Значение — plain-объект.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение — объект.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Значение — нагрузка события signal секретного звонка.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isSignalPayload(value: unknown): value is {
    call_id: string;
    from_user_id: string;
    from_device_id: string;
    type: string;
    sdp: string | null;
    candidate: string | null;
} {
    return isRecord(value)
        && typeof value.call_id === "string"
        && typeof value.from_user_id === "string"
        && typeof value.from_device_id === "string"
        && typeof value.type === "string"
        && (value.sdp === null || typeof value.sdp === "string")
        && (value.candidate === null || typeof value.candidate === "string");
}

/**
 * Преобразование разобранного JSON в параметры ICE-candidate.
 * @param {unknown} value - Значение из JSON.
 * @returns {RTCIceCandidateInit} - Параметры candidate.
 */
function toIceCandidateInit(value: unknown): RTCIceCandidateInit {

    if (!isRecord(value)) throw new Error("Некорректный ICE-candidate");
    const candidate = value.candidate;
    if (typeof candidate !== "string") throw new Error("Некорректный ICE-candidate");

    const init: RTCIceCandidateInit = { candidate };
    if (typeof value.sdpMid === "string") init.sdpMid = value.sdpMid;
    if (typeof value.sdpMLineIndex === "number") init.sdpMLineIndex = value.sdpMLineIndex;
    return init;

}

/**
 * ICE-серверы (STUN/TURN) из настроек сессии (null — если конфиг не найден).
 * @returns {RTCIceServer[]} - Список ICE-серверов.
 */
function getIceServers(): RTCIceServer[] {

    const session: unknown = LocalStorage.session;
    if (!session || typeof session !== "object" || !("server" in session)) return [];

    const server: unknown = session.server;
    if (!server || typeof server !== "object" || !("web_rtc" in server)) return [];

    const webRtc: unknown = server.web_rtc;
    if (!webRtc || typeof webRtc !== "object" || !("ice_servers" in webRtc)) return [];

    return Array.isArray(webRtc.ice_servers) ? webRtc.ice_servers as RTCIceServer[] : [];

}
