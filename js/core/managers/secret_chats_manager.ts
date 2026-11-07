// Импортируем config
import { Socket } from "../../config/socket.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { parseError } from "../../utils/network/parse_error.js";
import { base64urlToBuffer, bufferToBase64url } from "../../utils/helpers/webauthn.js";
import { genUuidv7 } from "../../utils/crypto/gen_uuidv7.js";
import {
    createChunkSalt,
    exportIdentityPrivateKey,
    generateEphemeralKeyPair,
    generateIdentityKeyPair,
    importIdentityKeyPair,
    type SecretKeyPair,
} from "../../utils/crypto/secret_crypto.js";
import {
    computeConfirmation,
    deriveSessionKeys,
    verifyConfirmation,
    type SecretSessionKeys,
} from "../../utils/crypto/secret_handshake.js";
import { computeFingerprint } from "../../utils/crypto/fingerprint.js";
import { Vault } from "../../utils/crypto/vault.js";
import { SecretConnection, type SecretConnectionState, type SecretLocalSignal } from "../../utils/secret_chats/secret_connection.js";
import {
    MAX_FRAME_SIZE,
    parseMessagePayload,
    type SecretControlMessage,
    type SecretFileOfferControl,
    type SecretFileRef,
    type SecretMessagePayload,
} from "../../utils/secret_chats/secret_frames.js";
import { secretChatsTable, secretFilesTable, secretMessagesTable } from "../../utils/secret_chats/secret_chats_db.js";
import {
    acceptRequest,
    closeRequest,
    declineRequest,
    inviteRequest,
    presenceSubscribeRequest,
    signalRequest,
} from "../../utils/secret_chats/secret_chats_requests.js";

// Импортируем типы
import type {
    SecretChatRecord,
    SecretFileRecord,
    SecretMessageRecord,
    SecretMessageType,
    SecretSelfDestructValue,
} from "../../types/secret_chats.js";

/**
 * Payload исходящего сообщения (поля по умолчанию проставляет менеджер).
 */
export interface SecretMessagePayloadInput {
    /** Текст сообщения. */
    text?: string | null;
    /** Id файла (одиночное вложение/стикер). */
    file_id?: string | null;
    /** Метаданные вложений (несколько файлов: metadata и миниатюры впереди оригиналов). */
    files?: SecretFileRef[] | null;
    /** Id сообщения, на которое дан ответ. */
    reply_to?: string | null;
    /** Длительность медиа в миллисекундах. */
    duration?: number | null;
}

/**
 * События SecretChatsManager для UI.
 */
export interface SecretChatsManagerEvents {
    /** Обновлён чат (статус, ключи, соединение). */
    "chat::updated": { chatId: string };
    /** Добавлено сообщение (входящее или исходящее). */
    "message::added": { chatId: string; messageId: string };
    /** Обновлено сообщение (статус доставки, редактирование). */
    "message::updated": { chatId: string; messageId: string };
    /** Удалено сообщение. */
    "message::removed": { chatId: string; messageId: string };
    /** Сменилось состояние P2P-соединения. */
    "connection::state": { chatId: string; state: SecretConnectionState };
    /** Собеседник активен (печатает/записывает). */
    "typing": { chatId: string; status: string };
    /** Прогресс передачи файла. */
    "file::progress": { chatId: string; fileId: string; loaded: number; total: number };
    /** Файл принят/сохранён целиком. */
    "file::done": { chatId: string; fileId: string };
    /** Передача файла прервана (обрыв соединения). */
    "file::failed": { chatId: string; fileId: string };
    /** Входящее приглашение в секретный чат (модалка на всех устройствах). */
    "chat::incoming": { chatId: string; peerUserId: string };
    /** Приглашение закрыто (отказ/принято в другом месте/отмена/таймаут). */
    "chat::invite-ended": { chatId: string; reason: "declined" | "taken" | "cancelled" | "timeout" };
}

/** Обработчик события менеджера. */
type SecretChatsEventHandler<K extends keyof SecretChatsManagerEvents> = (payload: SecretChatsManagerEvents[K]) => void;

/** Обработчик события с типом нагрузки, стёртым до unknown (внутреннее хранилище). */
type SecretChatsAnyHandler = (payload: unknown) => void;

// Ключевой материал чата в vault-контейнере записи (keys_encrypted)
interface SecretChatKeysData {
    /** Приватный ключ идентичности устройства (PKCS8, base64url). */
    identity_private: string;
    /** Публичный ключ идентичности устройства (SPKI, base64url). */
    identity_public: string;
}

// Принимаемый файл, собираемый из чанков
interface PendingFile {
    /** Метаданные файла из file_offer. */
    meta: SecretFileOfferControl;
    /** Полученные чанки (по индексам). */
    chunks: (Uint8Array<ArrayBuffer> | undefined)[];
    /** Принято байт. */
    received: number;
    /** file_done принят (финализация ждёт недостающие чанки). */
    done: boolean;
}

// Входящее приглашение в чат, ожидающее решения пользователя
interface PendingInvite {
    /** Id чата (UUIDv7, генерирует инициатор). */
    chatId: string;
    /** Id инициатора приглашения. */
    peerUserId: string;
    /** Устройство инициатора (session_id) — адресат accept/decline. */
    peerDeviceId: string;
    /** Публичный ключ идентичности инициатора (base64url). */
    identityKey: string;
    /** Эфемерный публичный ключ инициатора (base64url). */
    ephemeralKey: string;
    /** Таймер самоуничтожения сообщений чата. */
    selfDestruct: SecretSelfDestructValue | null;
    /** Таймер закрытия приглашения (как у звонков — никто не принял). */
    timer: ReturnType<typeof setTimeout> | null;
}

// Состояние секретного чата в памяти (зеркало записи + живые ключи/соединение)
interface ChatSession {
    /** Id чата. */
    chatId: string;
    /** Id собеседника. */
    peerUserId: string;
    /** Устройство собеседника (session_id); привязывается при принятии приглашения. */
    peerDeviceId: string | null;
    /** Устройства собеседника, которым отправлено приглашение (исходящее). */
    ringedDeviceIds: string[];
    /** Устройства собеседника, ответившие отказом (исходящее). */
    declinedDeviceIds: Set<string>;
    /** Приглашение закрыто (все отказали/таймаут) — авто-повторы выключены. */
    inviteStopped: boolean;
    /** Таймер жизни исходящего приглашения (снимается, если никто не принял). */
    inviteTimer: ReturnType<typeof setTimeout> | null;
    /** Таймер самоуничтожения сообщений. */
    selfDestruct: SecretSelfDestructValue | null;
    /** Ключи handshake: identity + текущий ephemeral. */
    identity: SecretKeyPair | null;
    ephemeral: SecretKeyPair | null;
    /** Ключи сессии (в памяти: ротация на каждое соединение). */
    keys: SecretSessionKeys | null;
    /** P2P-соединение. */
    connection: SecretConnection | null;
    /** Состояние соединения. */
    connectionState: SecretConnectionState | null;
    /** Invite отправлен, ждём accept. */
    invitePending: boolean;
    /** Чат закрывается намеренно (без реконнекта). */
    closing: boolean;
    /** Таймер реконнекта. */
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    /** Счётчик неудачных реконнектов (для экспоненциального backoff). */
    reconnectAttempts: number;
    /** Собираемые файлы. */
    pendingFiles: Map<string, PendingFile>;
}

// Пауза перед реконнектом после обрыва соединения (мс)
const RECONNECT_DELAY = 5000;

// Время жизни приглашения в чат (мс): по его истечении модалка снимается
// со всех устройств (как прозвон у звонков)
const INVITE_TIMEOUT = 45000;

// Таймеры самоуничтожения сообщений → миллисекунды
const SELF_DESTRUCT_MS: Record<SecretSelfDestructValue, number> = {
    "5s": 5_000,
    "1m": 60_000,
    "1h": 3_600_000,
    "1d": 86_400_000,
    "1w": 604_800_000,
};

// Потолок паузы реконнекта (мс): ровный retry при мёртвом TURN/сети
// штормит сигналингом и выбивает rate limit
const RECONNECT_MAX_DELAY = 60000;

// Размер чанка файла при передаче и локальном шифровании (байт). Кадр чанка
// (заголовок + nonce + шифр + тег GCM) обязан вписываться в лимит одного
// сообщения канала данных (MAX_FRAME_SIZE) — бо́льший кадр браузер отклоняет
// ошибкой «Message too large»
const FILE_CHUNK_SIZE = MAX_FRAME_SIZE - 128;

/**
 * ***************************************************************************
 * SecretChatsManager - менеджер секретных чатов (WebRTC P2P).
 *
 * Управляет жизненным циклом секретных чатов: handshake ключами (X3DH-lite
 * через сигналинг сервера), установка P2P-соединения (DataChannel) при
 * появлении собеседника в онлайне, очередь «не доставлено», передача файлов
 * чанками, ротация ключа при переподключении. Сообщения и файлы никогда не
 * проходят через сервер — только сигналинг SDP/ICE и presence.
 * ***************************************************************************
 */
export class SecretChatsManager {

    /** Экземпляр менеджера уровня сессии. */
    static instance: SecretChatsManager | null = null;

    /** Живые сессии чатов (память: ключи и соединения). */
    private readonly sessions = new Map<string, ChatSession>();

    /** Подписки на presence собеседников (id пользователей). */
    private readonly presencePeers = new Set<string>();

    /** Обработчики событий для UI. */
    private readonly handlers = new Map<keyof SecretChatsManagerEvents, Set<SecretChatsAnyHandler>>();

    /** Таймеры самоуничтожения сообщений (ключ — id сообщения). */
    private readonly selfDestructTimers = new Map<string, ReturnType<typeof setTimeout>>();

    /** Входящие приглашения в чат, ожидающие решения пользователя (ключ — id чата). */
    private readonly pendingInvites = new Map<string, PendingInvite>();

    /**
     * ***************************************************************************
     * Создание и запуск менеджера (подписки на события сокета и presence).
     * @returns {SecretChatsManager} - Экземпляр менеджера.
     * ***************************************************************************
     */
    static initial(): SecretChatsManager {

        if (this.instance) {
            Logger.warn("[app][SecretChatsManager]: менеджер уже инициализирован.");
            return this.instance;
        }

        const manager = new SecretChatsManager();
        this.instance = manager;
        manager._init().catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка инициализации:", error);
        });
        return manager;

    }

    /**
     * ***************************************************************************
     * Остановка менеджера: отписки, закрытие соединений, очистка таймеров.
     * ***************************************************************************
     */
    static destroy(): void {

        const manager = this.instance;
        if (!manager) return;

        // Отписываемся от событий сокета
        Socket.client.off("[secret-chat]: incoming", manager._onIncoming);
        Socket.client.off("[secret-chat]: accepted", manager._onAccepted);
        Socket.client.off("[secret-chat]: signal", manager._onSignal);
        Socket.client.off("[secret-chat]: closed", manager._onClosed);
        Socket.client.off("[secret-chat]: declined", manager._onDeclined);
        Socket.client.off("[secret-chat]: presence", manager._onPresence);

        // Отписываемся от presence собеседников
        for (const userId of manager.presencePeers) {
            Socket.client.timeout(5000).emitWithAck("[secret-chat]: presence unsubscribe", { user_id: userId }).catch((error) => {
                Logger.debug("[app][SecretChatsManager]: ошибка отписки presence:", error);
            });
        }

        // Закрываем соединения и таймеры
        for (const session of manager.sessions.values()) {
            session.closing = true;
            if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
            if (session.inviteTimer) clearTimeout(session.inviteTimer);
            session.connection?.close();
        }
        manager.sessions.clear();

        // Гасим непринятые приглашения
        for (const invite of manager.pendingInvites.values()) {
            if (invite.timer) clearTimeout(invite.timer);
        }
        manager.pendingInvites.clear();
        manager.handlers.clear();

        // Гасим таймеры самоуничтожения
        for (const timer of manager.selfDestructTimers.values()) clearTimeout(timer);
        manager.selfDestructTimers.clear();

        this.instance = null;

    }

    /**
     * ***************************************************************************
     * Подписка на событие менеджера.
     * @param {keyof SecretChatsManagerEvents} event - Имя события.
     * @param {Function} handler - Обработчик.
     * @returns {Function} - Функция отписки.
     * ***************************************************************************
     */
    on<K extends keyof SecretChatsManagerEvents>(event: K, handler: SecretChatsEventHandler<K>): () => void {

        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }

        // Обёртка стирает тип нагрузки для внутреннего хранилища
        // invariant: payload всегда формируется в _emit с типом события K
        const wrapped: SecretChatsAnyHandler = (payload) => handler(payload as SecretChatsManagerEvents[K]);
        set.add(wrapped);
        return () => {
            set.delete(wrapped);
        };

    }

    // ===========================================================================
    // Публичное API (используется формой секретного чата)
    // ===========================================================================

    /**
     * ***************************************************************************
     * Состояние P2P-соединения чата (для UI: бейдж на аватарке, шапка).
     * @param {string} chatId - Id чата.
     * @returns {SecretConnectionState | null} - Состояние либо null (сессии нет).
     * ***************************************************************************
     */
    getConnectionState(chatId: string): SecretConnectionState | null {
        return this.sessions.get(chatId)?.connectionState ?? null;
    }

    /**
     * ***************************************************************************
     * Создание секретного чата с пользователем: приглашение уходит на все
     * онлайн-устройства собеседника, каждое показывает модалку — чат
     * привязывается к устройству, которое примет приглашение.
     * @param {string} peerUserId - Id собеседника.
     * @param {SecretSelfDestructValue | null} selfDestruct - Таймер самоуничтожения.
     * @returns {Promise<string | null>} - Id созданного чата либо null (собеседник офлайн).
     * ***************************************************************************
     */
    async createChat(peerUserId: string, selfDestruct: SecretSelfDestructValue | null): Promise<string | null> {

        // Устройства собеседника (presence виден только контактам)
        const response = await presenceSubscribeRequest(peerUserId);
        const devices = response.data?.devices ?? [];
        if (devices.length === 0) return null;

        const chatId = genUuidv7();
        const session: ChatSession = {
            chatId,
            peerUserId,
            peerDeviceId: null,
            ringedDeviceIds: devices,
            declinedDeviceIds: new Set(),
            inviteStopped: false,
            inviteTimer: null,
            selfDestruct,
            identity: null,
            ephemeral: null,
            keys: null,
            connection: null,
            connectionState: null,
            invitePending: false,
            closing: false,
            reconnectTimer: null,
            reconnectAttempts: 0,
            pendingFiles: new Map(),
        };
        this.sessions.set(chatId, session);

        // Сохраняем запись чата локально (устройство собеседника привяжется
        // к тому, которое примет приглашение)
        await this._saveChat({
            id: chatId,
            peer_user_id: peerUserId,
            peer_device_id: null,
            status: "pending",
            verified: false,
            self_destruct: selfDestruct,
            peer_identity_public: null,
            keys_encrypted: null,
            created_at: Date.now(),
            last_message_at: Date.now(),
        });

        // Следим за presence собеседника и стартуем handshake (рассылка
        // приглашений всем онлайн-устройствам)
        await this._subscribePresence(peerUserId);
        await this._startHandshake(session);
        this._emit("chat::updated", { chatId });
        return chatId;

    }

    /**
     * ***************************************************************************
     * Снимок входящего приглашения для модалки (профиль инициатора).
     * @param {string} chatId - Id чата (приглашения).
     * @returns {object | null} - Снимок приглашения либо null (приглашения нет).
     * ***************************************************************************
     */
    getPendingInvite(chatId: string): { peerUserId: string } | null {

        const invite = this.pendingInvites.get(chatId);
        if (!invite) return null;
        return { peerUserId: invite.peerUserId };

    }

    /**
     * ***************************************************************************
     * Принять входящее приглашение: чат создаётся на этом устройстве и
     * привязывается к устройству инициатора.
     * @param {string} chatId - Id чата (приглашения).
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async acceptChat(chatId: string): Promise<void> {

        const invite = this.pendingInvites.get(chatId);
        if (!invite) return;

        // Свои ключи handshake: долговременный identity + свежий ephemeral
        const identity = await this._ensureIdentity(null);
        const ephemeral = await generateEphemeralKeyPair();
        const session: ChatSession = {
            chatId: invite.chatId,
            peerUserId: invite.peerUserId,
            peerDeviceId: invite.peerDeviceId,
            ringedDeviceIds: [],
            declinedDeviceIds: new Set(),
            inviteStopped: false,
            inviteTimer: null,
            selfDestruct: invite.selfDestruct,
            identity,
            ephemeral,
            keys: null,
            connection: null,
            connectionState: null,
            invitePending: false,
            closing: false,
            reconnectTimer: null,
            reconnectAttempts: 0,
            pendingFiles: new Map(),
        };
        this.sessions.set(session.chatId, session);

        // Сохраняем чат и вычисляем ключ сессии
        await this._saveChat({
            id: session.chatId,
            peer_user_id: session.peerUserId,
            peer_device_id: session.peerDeviceId,
            status: "active",
            verified: false,
            self_destruct: session.selfDestruct,
            peer_identity_public: invite.identityKey,
            keys_encrypted: await this._packKeys(session),
            created_at: Date.now(),
            last_message_at: Date.now(),
        });
        session.keys = await deriveSessionKeys(
            { identity, ephemeral },
            { identityPublic: base64urlToBuffer(invite.identityKey), ephemeralPublic: base64urlToBuffer(invite.ephemeralKey) },
            session.chatId,
        );

        // Отвечаем своим ключом handshake
        await acceptRequest({
            chat_id: session.chatId,
            target_device_id: invite.peerDeviceId,
            identity_key: bufferToBase64url(identity.publicKey),
            ephemeral_key: bufferToBase64url(ephemeral.publicKey),
        });

        // Приглашение принято этим устройством — снимаем его локально
        if (invite.timer) clearTimeout(invite.timer);
        this.pendingInvites.delete(invite.chatId);

        await this._subscribePresence(session.peerUserId);
        this._emit("chat::updated", { chatId: session.chatId });

        // Соединение устанавливает устройство с меньшим device_id
        if (this._isOfferer(this._getSelfDeviceId(), invite.peerDeviceId) && !session.connection) await this._connect(session);

    }

    /**
     * ***************************************************************************
     * Отклонить входящее приглашение (отказ уходит инициатору).
     * @param {string} chatId - Id чата (приглашения).
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async declineChat(chatId: string): Promise<void> {

        const invite = this.pendingInvites.get(chatId);
        if (!invite) return;

        await declineRequest({ chat_id: chatId, target_device_id: invite.peerDeviceId, reason: "declined" }).catch((error) => {
            Logger.debug("[app][SecretChatsManager]: инициатор не получил отказ:", error);
        });
        this._closePendingInvite(invite, "declined");

    }

    /**
     * ***************************************************************************
     * Повторная отправка приглашения (ручной повтор после отказа всех
     * устройств или таймаута).
     * @param {string} chatId - Id чата.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async retryInvite(chatId: string): Promise<void> {

        const session = this._requireSession(chatId);

        // Чат уже принят — повторять нечего
        if (session.keys) return;

        session.inviteStopped = false;
        session.invitePending = false;
        await this._startHandshake(session);

    }

    /**
     * ***************************************************************************
     * Отправка сообщения в секретный чат (в очередь «не доставлено»).
     * @param {string} chatId - Id чата.
     * @param {SecretMessageType} msgType - Тип сообщения.
     * @param {SecretMessagePayloadInput} input - Данные сообщения.
     * @returns {Promise<string>} - Id сообщения.
     * ***************************************************************************
     */
    async sendMessage(chatId: string, msgType: SecretMessageType, input: SecretMessagePayloadInput): Promise<string> {

        const messageId = genUuidv7();
        const payload: SecretMessagePayload = {
            text: input.text ?? null,
            file_id: input.file_id ?? null,
            files: input.files ?? null,
            reply_to: input.reply_to ?? null,
            duration: input.duration ?? null,
            created_at: Date.now(),
        };

        await this._saveMessage({
            id: messageId,
            chat_id: chatId,
            sender: "me",
            type: msgType,
            ciphertext: await Vault.encryptJson(payload),
            status: "queued",
            created_at: payload.created_at,
            // Таймер самоуничтожения фиксируется на сообщении (новым
            // сообщениям — таймер чата на момент отправки)
            self_destruct: (await this._requireChatRecord(chatId)).self_destruct,
        });
        this._emit("message::added", { chatId, messageId });

        await this._flushQueue(chatId);
        return messageId;

    }

    /**
     * ***************************************************************************
     * Передача файла сообщения собеседнику чанками (file_offer → чанки → file_done).
     *
     * Файл принадлежит уже созданному сообщению (его метаданные и миниатюры
     * ушли в payload сообщения). Локальная шифрованная копия сохраняется для
     * истории; без resume: обрыв помечает файл failed.
     * @param {string} chatId - Id чата.
     * @param {string} messageId - Id сообщения-владельца.
     * @param {string} fileId - Id файла (UUIDv7, тот же, что в payload сообщения).
     * @param {Blob} blob - Данные файла.
     * @param {object} meta - Метаданные файла.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async transferFile(
        chatId: string,
        messageId: string,
        fileId: string,
        blob: Blob,
        meta: { name: string; mime_type: string; duration: number | null; width: number | null; height: number | null },
    ): Promise<void> {

        const session = this._requireSession(chatId);
        const connection = session.connection;
        if (!connection || session.connectionState !== "connected") throw new Error("Соединение с собеседником не установлено");

        const salt = createChunkSalt();
        const chunksCount = Math.max(1, Math.ceil(blob.size / FILE_CHUNK_SIZE));

        // Читаем файл чанками: шифрованная копия для локального хранения + отправка
        const storedChunks: Blob[] = [];
        for (let index = 0; index < chunksCount; index++) {
            const slice = blob.slice(index * FILE_CHUNK_SIZE, Math.min((index + 1) * FILE_CHUNK_SIZE, blob.size));
            const data = new Uint8Array(await slice.arrayBuffer());
            storedChunks.push(new Blob([await Vault.encryptChunk(salt, index, data)]));
        }

        await this._saveFile({
            id: fileId,
            message_id: messageId,
            chat_id: chatId,
            name: meta.name,
            mime_type: meta.mime_type,
            size: blob.size,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            chunk_salt: salt,
            chunks: storedChunks,
            status: "complete",
        });

        try {

            // Объявляем файл, передаём чанки, подтверждаем завершение
            await connection.sendControl({
                type: "file_offer",
                file_id: fileId,
                message_id: messageId,
                name: meta.name,
                mime_type: meta.mime_type,
                size: blob.size,
                duration: meta.duration,
                width: meta.width,
                height: meta.height,
            });

            let loaded = 0;
            for (let index = 0; index < chunksCount; index++) {
                const slice = blob.slice(index * FILE_CHUNK_SIZE, Math.min((index + 1) * FILE_CHUNK_SIZE, blob.size));
                const data = new Uint8Array(await slice.arrayBuffer());
                await connection.sendFileChunk(fileId, index, data);
                loaded += data.length;
                this._emit("file::progress", { chatId, fileId, loaded, total: blob.size });
            }
            await connection.sendControl({ type: "file_done", file_id: fileId });

            // Файл доставлен
            this._emit("file::done", { chatId, fileId });

        } catch (error) {

            // Обрыв при передаче: файл помечаем failed (resume в v1 нет)
            Logger.error("[app][SecretChatsManager]: ошибка передачи файла:", error);
            const file = await secretFilesTable().get(fileId);
            if (file) await this._saveFile({ ...file, status: "failed" });
            this._emit("file::failed", { chatId, fileId });
            throw error;

        }

    }

    /**
     * ***************************************************************************
     * Редактирование сообщения секретного чата.
     * @param {string} chatId - Id чата.
     * @param {string} messageId - Id сообщения.
     * @param {SecretMessagePayloadInput} input - Новые данные сообщения.
     * ***************************************************************************
     */
    async updateMessage(chatId: string, messageId: string, input: SecretMessagePayloadInput): Promise<void> {

        const session = this._requireSession(chatId);
        const record = await secretMessagesTable().get(messageId);
        if (!record) throw new Error("Сообщение не найдено");

        // Медиа-поля сохраняем из текущего payload: правка текста
        // не должна стирать вложения сообщения
        const existing = parseMessagePayload(await Vault.decryptJson(record.ciphertext));

        const payload: SecretMessagePayload = {
            text: input.text ?? null,
            file_id: existing.file_id,
            files: existing.files,
            reply_to: input.reply_to ?? null,
            duration: input.duration ?? null,
            created_at: record.created_at,
        };
        await this._saveMessage({ ...record, ciphertext: await Vault.encryptJson(payload) });
        this._emit("message::updated", { chatId, messageId });

        // Передаём правку собеседнику (при живом соединении)
        await session.connection?.sendControl({ type: "msg_update", message_id: messageId, payload });

    }

    /**
     * ***************************************************************************
     * Удаление сообщения секретного чата (у обоих участников).
     * @param {string} chatId - Id чата.
     * @param {string} messageId - Id сообщения.
     * ***************************************************************************
     */
    async removeMessage(chatId: string, messageId: string): Promise<void> {

        const session = this._requireSession(chatId);
        this._clearSelfDestruct(messageId);
        await secretMessagesTable().delete(messageId);
        await secretFilesTable().where("message_id").equals(messageId).delete();
        this._emit("message::removed", { chatId, messageId });

        // Извещаем собеседника (при живом соединении)
        await session.connection?.sendControl({ type: "msg_remove", message_id: messageId });

    }

    /**
     * ***************************************************************************
     * Запуск самоуничтожения сообщения (первый просмотр): фиксирует момент
     * удаления (self_destruct_at) и ставит таймер, по истечении сообщение
     * физически удаляется у обоих участников (msg_remove).
     * @param {string} chatId - Id чата.
     * @param {string} messageId - Id сообщения.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async touchSelfDestruct(chatId: string, messageId: string): Promise<void> {

        const record = await secretMessagesTable().get(messageId);
        if (!record?.self_destruct) return;

        // Таймер уже запущен (просмотр/прочтение были раньше) —
        // пересчитываем остаток и ставим заново
        if (record.self_destruct_at != null) {
            this._scheduleSelfDestruct(chatId, record);
            return;
        }

        // Первый просмотр: фиксируем момент удаления
        const updated = { ...record, self_destruct_at: Date.now() + SELF_DESTRUCT_MS[record.self_destruct] };
        await this._saveMessage(updated);
        this._scheduleSelfDestruct(chatId, updated);

    }

    /**
     * ***************************************************************************
     * Установка таймера самоуничтожения чата: сохранение в записи чата и
     * обновление сессии (входящие сообщения штампуются её значением).
     * Выключение отменяет уже запущенные таймеры сообщений.
     * @param {string} chatId - Id чата.
     * @param {SecretSelfDestructValue | null} value - Значение таймера (null — выключен).
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async setSelfDestruct(chatId: string, value: SecretSelfDestructValue | null): Promise<void> {

        const session = this._requireSession(chatId);

        // Таймер фиксируется на сообщении в момент приёма/отправки, поэтому
        // выключение гасит уже запущенные таймеры и снимает флаги с сообщений:
        // иначе «выключенный» таймер продолжал удалять сообщения
        if (value === null) await this._cancelSelfDestruct(chatId);

        session.selfDestruct = value;
        await this._saveChat({ ...(await this._requireChatRecord(chatId)), self_destruct: value });
        this._emit("chat::updated", { chatId });

    }

    /**
     * ***************************************************************************
     * Установка статуса верификации чата (сверка отпечатка ключей пройдена).
     * @param {string} chatId - Id чата.
     * @param {boolean} verified - Статус верификации.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async setVerified(chatId: string, verified: boolean): Promise<void> {

        const record = await this._requireChatRecord(chatId);
        await this._saveChat({ ...record, verified });
        this._emit("chat::updated", { chatId });

    }

    /**
     * ***************************************************************************
     * Данные для сверки ключей чата: отпечаток пары identity-ключей устройств
     * (для эмодзи и текстового отображения). Пока собеседник не обменялся
     * ключом handshake — null (сверять нечего).
     * @param {string} chatId - Id чата.
     * @returns {Promise<object | null>} - Отпечаток, собственный публичный ключ
     * идентичности и статус верификации либо null.
     * ***************************************************************************
     */
    async getVerificationData(chatId: string): Promise<{ fingerprint: Uint8Array<ArrayBuffer>; verified: boolean } | null> {

        const session = this._requireSession(chatId);
        const record = await this._requireChatRecord(chatId);

        // Свой identity может жить только в памяти (чат создан до сохранения ключей)
        const identity = session.identity ?? await this._loadIdentity(record);
        if (!identity || !record.peer_identity_public) return null;

        return {
            fingerprint: await computeFingerprint(identity.publicKey, base64urlToBuffer(record.peer_identity_public)),
            verified: record.verified,
        };

    }

    /**
     * ***************************************************************************
     * Постановка таймера самоуничтожения по записи (остаток времени до
     * self_destruct_at; по истечении — удаление у обоих участников).
     * @param {string} chatId - Id чата.
     * @param {SecretMessageRecord} record - Запись сообщения.
     * @returns {void}
     * ***************************************************************************
     */
    private _scheduleSelfDestruct(chatId: string, record: SecretMessageRecord): void {

        if (!record.self_destruct || record.self_destruct_at == null) return;

        // Снимаем прежний таймер (если был)
        this._clearSelfDestruct(record.id);

        // Остаток времени (при повторном просмотре срок не продлевается)
        const delay = Math.max(0, record.self_destruct_at - Date.now());

        const timer = setTimeout(() => {
            this.selfDestructTimers.delete(record.id);
            this.removeMessage(chatId, record.id).catch((error) => {
                Logger.error("[app][SecretChatsManager]: ошибка самоуничтожения сообщения:", error);
            });
        }, delay);

        this.selfDestructTimers.set(record.id, timer);

    }

    /**
     * ***************************************************************************
     * Снятие таймера самоуничтожения сообщения.
     * @param {string} messageId - Id сообщения.
     * @returns {void}
     * ***************************************************************************
     */
    private _clearSelfDestruct(messageId: string): void {

        const timer = this.selfDestructTimers.get(messageId);
        if (!timer) return;
        clearTimeout(timer);
        this.selfDestructTimers.delete(messageId);

    }

    /**
     * ***************************************************************************
     * Отмена самоуничтожения сообщений чата: снятие таймеров и флагов таймера
     * с сообщений (выключение таймера чата).
     * @param {string} chatId - Id чата.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    private async _cancelSelfDestruct(chatId: string): Promise<void> {

        const records = await secretMessagesTable().where("chat_id").equals(chatId).toArray();
        for (const record of records) {

            // Сообщения без таймера не трогаем (их большинство)
            if (!record.self_destruct && record.self_destruct_at == null) continue;

            this._clearSelfDestruct(record.id);
            await this._saveMessage({ ...record, self_destruct: null, self_destruct_at: null });
            this._emit("message::updated", { chatId, messageId: record.id });

        }

    }

    /**
     * ***************************************************************************
     * Закрытие входящего приглашения (отказ/принято в другом месте/отмена/
     * таймаут): снятие таймера и событие для UI.
     * @param {PendingInvite} invite - Приглашение.
     * @param {"declined" | "taken" | "cancelled" | "timeout"} reason - Причина закрытия.
     * @returns {void}
     * ***************************************************************************
     */
    private _closePendingInvite(invite: PendingInvite, reason: "declined" | "taken" | "cancelled" | "timeout"): void {

        if (invite.timer) clearTimeout(invite.timer);
        this.pendingInvites.delete(invite.chatId);
        this._emit("chat::invite-ended", { chatId: invite.chatId, reason });

    }

    /**
     * ***************************************************************************
     * Снятие исходящего приглашения с устройств собеседника (принято в другом
     * месте / отмена / таймаут).
     * @param {ChatSession} session - Сессия чата.
     * @param {"taken" | "cancelled" | "timeout"} reason - Причина снятия.
     * @returns {void}
     * ***************************************************************************
     */
    private _declineInvitees(session: ChatSession, reason: "taken" | "cancelled" | "timeout"): void {

        for (const deviceId of session.ringedDeviceIds) {
            if (deviceId === session.peerDeviceId || session.declinedDeviceIds.has(deviceId)) continue;
            declineRequest({ chat_id: session.chatId, target_device_id: deviceId, reason }).catch(() => undefined);
        }

    }

    /**
     * ***************************************************************************
     * Истечение времени исходящего приглашения: снимает его со всех устройств
     * (как прозвон у звонков).
     * @param {ChatSession} session - Сессия чата.
     * @returns {void}
     * ***************************************************************************
     */
    private _expireInvite(session: ChatSession): void {

        session.inviteTimer = null;

        // Приглашение уже принято — таймер гасится в _handleAccepted
        if (session.peerDeviceId) return;

        session.inviteStopped = true;
        session.invitePending = false;
        this._declineInvitees(session, "timeout");
        this._emit("chat::invite-ended", { chatId: session.chatId, reason: "timeout" });

    }

    /**
     * ***************************************************************************
     * Отправка квитанции (доставлено/просмотрено).
     * @param {string} chatId - Id чата.
     * @param {string[]} messageIds - Id сообщений.
     * @param {"delivered" | "read"} status - Статус квитанции.
     * ***************************************************************************
     */
    async sendReceipt(chatId: string, messageIds: string[], status: "delivered" | "read"): Promise<void> {
        const session = this._requireSession(chatId);
        if (messageIds.length === 0) return;
        await session.connection?.sendControl({ type: "receipt", message_ids: messageIds, status });
    }

    /**
     * ***************************************************************************
     * Отправка статуса активности («печатает…»).
     * @param {string} chatId - Id чата.
     * @param {string} status - Статус активности.
     * ***************************************************************************
     */
    async sendTyping(chatId: string, status: "typing" | "recording_audio" | "recording_video" | "uploading_document"): Promise<void> {
        const session = this._requireSession(chatId);
        await session.connection?.sendControl({ type: "typing", status });
    }

    /**
     * ***************************************************************************
     * Удаление секретного чата: локальная очистка + извещение собеседника.
     * @param {string} chatId - Id чата.
     * ***************************************************************************
     */
    async closeChat(chatId: string): Promise<void> {

        const session = this.sessions.get(chatId);
        if (!session) return;

        // Помечаем закрытие (без реконнекта) и извещаем собеседника:
        // принявшее устройство — об удалении чата, приглашённые — об отмене
        session.closing = true;
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        if (session.inviteTimer) clearTimeout(session.inviteTimer);
        session.connection?.close();
        const targets = session.peerDeviceId ? [session.peerDeviceId] : session.ringedDeviceIds;
        for (const deviceId of targets) {
            await closeRequest({ chat_id: chatId, target_device_id: deviceId }).catch((error) => {
                Logger.debug("[app][SecretChatsManager]: собеседник не получил извещение об удалении:", error);
            });
        }

        // Удаляем локальные данные чата
        this.sessions.delete(chatId);
        await this._deleteChatData(chatId);
        this._emit("chat::updated", { chatId });

    }

    // ===========================================================================
    // Инициализация и события сокета
    // ===========================================================================

    /**
     * ***************************************************************************
     * Инициализация: восстановление чатов из IndexedDB, подписки на события
     * сокета и presence собеседников.
     * ***************************************************************************
     */
    private async _init(): Promise<void> {

        // Подписываемся на события сигналинга
        Socket.client.on("[secret-chat]: incoming", this._onIncoming);
        Socket.client.on("[secret-chat]: accepted", this._onAccepted);
        Socket.client.on("[secret-chat]: signal", this._onSignal);
        Socket.client.on("[secret-chat]: closed", this._onClosed);
        Socket.client.on("[secret-chat]: declined", this._onDeclined);
        Socket.client.on("[secret-chat]: presence", this._onPresence);

        // Восстанавливаем чаты из локального хранилища
        const records = await secretChatsTable().toArray();
        for (const record of records) {
            if (record.status === "closed") continue;

            const session: ChatSession = {
                chatId: record.id,
                peerUserId: record.peer_user_id,
                peerDeviceId: record.peer_device_id ?? null,
                ringedDeviceIds: [],
                declinedDeviceIds: new Set(),
                inviteStopped: false,
                inviteTimer: null,
                selfDestruct: record.self_destruct,
                identity: await this._loadIdentity(record),
                ephemeral: null,
                keys: null,
                connection: null,
                connectionState: null,
                invitePending: false,
                closing: false,
                reconnectTimer: null,
                reconnectAttempts: 0,
                pendingFiles: new Map(),
            };
            this.sessions.set(record.id, session);
        }

        // Следим за presence собеседников: соединение поднимем при появлении в сети
        for (const session of this.sessions.values()) {
            await this._subscribePresence(session.peerUserId);
        }

    }

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: incoming" — приглашение/rekey от собеседника.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onIncoming = (data: unknown): void => {
        this._handleIncoming(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки incoming:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: accepted" — собеседник принял чат.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onAccepted = (data: unknown): void => {
        this._handleAccepted(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки accepted:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: signal" — WebRTC-сигнал собеседника.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onSignal = (data: unknown): void => {
        this._handleSignal(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки signal:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: closed" — собеседник удалил чат.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onClosed = (data: unknown): void => {
        this._handleClosed(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки closed:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: declined" — отказ от приглашения или его
     * снятие (принято в другом месте / отмена / таймаут).
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onDeclined = (data: unknown): void => {
        this._handleDeclined(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки declined:", error);
        });
    };

    /**
     * ***************************************************************************
     * Обработчик "[secret-chat]: presence" — устройство собеседника онлайн/офлайн.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private _onPresence = (data: unknown): void => {
        this._handlePresence(data).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка обработки presence:", error);
        });
    };

    // ===========================================================================
    // Handshake ключами (X3DH-lite через сигналинг)
    // ===========================================================================

    /**
     * ***************************************************************************
     * Старт handshake: отправка приглашения с публичными ключами.
     * Для существующего чата это ротация ключа (rekey) при переподключении.
     * @param {ChatSession} session - Сессия чата.
     * ***************************************************************************
     */
    private async _startHandshake(session: ChatSession): Promise<void> {

        // Готовим ключи: долговременный identity + свежий одноразовый ephemeral
        session.identity = await this._ensureIdentity(session);
        session.ephemeral = await generateEphemeralKeyPair();

        // Identity сохраняем, если его ещё нет в хранилище: отпечаток для
        // сверки ключей обязан быть стабильным между перезапусками — иначе
        // после reload ключ пересоздавался, и сверка «прыгала»
        const record = await this._requireChatRecord(session.chatId);
        if (!record.keys_encrypted) {
            await this._saveChat({ ...record, keys_encrypted: await this._packKeys(session) });
        }

        // Приглашение уходит всем онлайн-устройствам собеседника: принять
        // его может любое из них (как у звонков — выбор устройства)
        const response = await presenceSubscribeRequest(session.peerUserId);
        const devices = response.data?.devices ?? [];
        if (devices.length === 0) {

            // Собеседник офлайн: ждём его presence и повторим handshake
            Logger.debug(`[app][SecretChatsManager][${session.chatId}]: собеседник офлайн, ждём presence`);
            session.invitePending = false;
            return;

        }

        session.ringedDeviceIds = devices;
        session.declinedDeviceIds.clear();
        session.inviteStopped = false;
        session.invitePending = true;

        const identityKey = bufferToBase64url(session.identity.publicKey);
        const ephemeralKey = bufferToBase64url(session.ephemeral.publicKey);
        for (const deviceId of devices) {
            inviteRequest({
                chat_id: session.chatId,
                target_device_id: deviceId,
                identity_key: identityKey,
                ephemeral_key: ephemeralKey,
                self_destruct: session.selfDestruct,
            }).catch((error) => {
                Logger.debug("[app][SecretChatsManager]: устройство не получило приглашение:", error);
            });
        }

        // Приглашение снимается по таймеру, если его никто не принял
        if (session.inviteTimer) clearTimeout(session.inviteTimer);
        session.inviteTimer = setTimeout(() => {
            this._expireInvite(session);
        }, INVITE_TIMEOUT);

    }

    /**
     * ***************************************************************************
     * Обработка приглашения/rekey от собеседника.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private async _handleIncoming(data: unknown): Promise<void> {

        if (!isIncomingPayload(data)) return;
        const selfDeviceId = this._getSelfDeviceId();

        // ---------- REKEY ----------
        // Чат уже известен: собеседник переподключился — ротируем ключ сессии
        const existing = this.sessions.get(data.chat_id);
        if (existing) {
            const identity = await this._ensureIdentity(existing);
            const ephemeral = await generateEphemeralKeyPair();
            existing.identity = identity;
            existing.ephemeral = ephemeral;
            existing.keys = await deriveSessionKeys(
                { identity, ephemeral },
                { identityPublic: base64urlToBuffer(data.identity_key), ephemeralPublic: base64urlToBuffer(data.ephemeral_key) },
                data.chat_id,
            );
            existing.connection?.close();
            existing.connection = null;
            await acceptRequest({
                chat_id: data.chat_id,
                target_device_id: data.from_device_id,
                identity_key: bufferToBase64url(identity.publicKey),
                ephemeral_key: bufferToBase64url(ephemeral.publicKey),
            });
            await this._saveChat({ ...(await this._requireChatRecord(data.chat_id)), status: "active", peer_identity_public: data.identity_key });

            // Соединение могло подняться сигналом во время обмена accept —
            // второе не создаём
            if (this._isOfferer(selfDeviceId, data.from_device_id) && !existing.connection) await this._connect(existing);
            return;
        }

        // ---------- ГОНКА ДВУХ ЧАТОВ ----------
        // Оба создали чат одновременно: побеждает устройство с меньшим device_id
        const rival = this._findPendingChatByPeer(data.from_user_id, data.from_device_id);
        if (rival) {
            if (selfDeviceId < data.from_device_id) {
                Logger.debug("[app][SecretChatsManager]: наш invite приоритетнее (меньший device_id)");
                return;
            }
            await this._deleteChatData(rival.chatId);
            this.sessions.delete(rival.chatId);
        }

        // ---------- НОВОЕ ПРИГЛАШЕНИЕ ----------
        // Принимает пользователь — на том устройстве, которое выберет сам
        // (модалка приглашения; авто-accept убран намеренно)
        if (this.pendingInvites.has(data.chat_id)) return;

        const invite: PendingInvite = {
            chatId: data.chat_id,
            peerUserId: data.from_user_id,
            peerDeviceId: data.from_device_id,
            identityKey: data.identity_key,
            ephemeralKey: data.ephemeral_key,
            selfDestruct: data.self_destruct,
            timer: setTimeout(() => {

                // Таймер инициатора может молчать (он офлайн) — закрываем локально
                const pending = this.pendingInvites.get(data.chat_id);
                if (pending) this._closePendingInvite(pending, "timeout");

            }, INVITE_TIMEOUT),
        };
        this.pendingInvites.set(invite.chatId, invite);
        this._emit("chat::incoming", { chatId: invite.chatId, peerUserId: invite.peerUserId });

    }

    /**
     * ***************************************************************************
     * Обработка принятия чата собеседником: вычисление ключа сессии и
     * установка соединения (для роли offerer).
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private async _handleAccepted(data: unknown): Promise<void> {

        if (!isAcceptedPayload(data)) return;
        const session = this.sessions.get(data.chat_id);
        if (!session || !session.identity || !session.ephemeral) return;

        // Приглашение уже принято другим устройством: поздний ответ
        // отклоняем, чтобы чат не жил в двух разных ключах
        if (session.peerDeviceId && session.peerDeviceId !== data.from_device_id) {
            declineRequest({ chat_id: session.chatId, target_device_id: data.from_device_id, reason: "taken" }).catch(() => undefined);
            return;
        }

        // Вычисляем ключ сессии из ключей обеих сторон
        session.keys = await deriveSessionKeys(
            { identity: session.identity, ephemeral: session.ephemeral },
            { identityPublic: base64urlToBuffer(data.identity_key), ephemeralPublic: base64urlToBuffer(data.ephemeral_key) },
            session.chatId,
        );
        session.peerDeviceId = data.from_device_id;
        session.invitePending = false;

        // Принято: гасим таймер приглашения и снимаем его с остальных устройств
        if (session.inviteTimer) {
            clearTimeout(session.inviteTimer);
            session.inviteTimer = null;
        }
        this._declineInvitees(session, "taken");

        await this._saveChat({ ...(await this._requireChatRecord(session.chatId)), status: "active", peer_identity_public: data.identity_key });
        this._emit("chat::updated", { chatId: session.chatId });

        // Соединение устанавливает устройство с меньшим device_id
        if (this._isOfferer(this._getSelfDeviceId(), session.peerDeviceId) && !session.connection) await this._connect(session);

    }

    /**
     * ***************************************************************************
     * Обработка WebRTC-сигнала собеседника.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private async _handleSignal(data: unknown): Promise<void> {

        if (!isSignalPayload(data)) return;
        const session = this.sessions.get(data.chat_id);
        if (!session) return;

        // Завершение соединения собеседником
        if (data.type === "hangup") {
            session.connection?.close();
            session.connection = null;
            return;
        }

        // Новый offer собеседника = он переподключается после обрыва. На
        // мёртвом соединении отвечать нельзя — канал уже не поднимется:
        // гасим его, свежее создастся ниже
        if (data.type === "offer" && session.connection && session.connectionState !== "connected") {
            const dead = session.connection;
            session.connection = null;
            dead.close();
        }

        // Сигнал offer может прийти раньше, чем мы создали соединение (роль answerer)
        if (!session.connection && (data.type === "offer" || data.type === "candidate") && session.keys) {
            await this._connect(session);
        }

        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            await session.connection?.handleSignal(data.type, data.sdp, data.candidate);
        }

    }

    /**
     * ***************************************************************************
     * Обработка удаления чата собеседником: локальная очистка.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private async _handleClosed(data: unknown): Promise<void> {

        if (!isClosedPayload(data)) return;

        // Непринятое приглашение: инициатор закрыл/удалил чат до принятия
        const invite = this.pendingInvites.get(data.chat_id);
        if (invite) {
            this._closePendingInvite(invite, "cancelled");
            return;
        }

        const session = this.sessions.get(data.chat_id);
        if (!session) return;

        session.closing = true;
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        session.connection?.close();
        this.sessions.delete(data.chat_id);
        await this._deleteChatData(data.chat_id);
        this._emit("chat::updated", { chatId: data.chat_id });

    }

    /**
     * ***************************************************************************
     * Обработка отказа от приглашения (или его снятия): на принимающей стороне
     * закрывает модалку, на стороне инициатора — учитывает отказы устройств.
     * @param {unknown} data - Нагрузка события.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    private async _handleDeclined(data: unknown): Promise<void> {

        if (!isDeclinedPayload(data)) return;

        // Входящее приглашение (мы на принимающей стороне)
        const invite = this.pendingInvites.get(data.chat_id);
        if (invite) {
            this._closePendingInvite(invite, normalizeDeclineReason(data.reason));
            return;
        }

        // Наше исходящее приглашение: отказ одного из устройств
        const session = this.sessions.get(data.chat_id);
        if (!session || session.peerDeviceId) return;

        session.declinedDeviceIds.add(data.from_device_id);

        // Все отказали — авто-повторы выключаем, приглашение закрыто
        if (data.reason === "declined" && session.declinedDeviceIds.size >= session.ringedDeviceIds.length) {
            session.inviteStopped = true;
            session.invitePending = false;
            if (session.inviteTimer) {
                clearTimeout(session.inviteTimer);
                session.inviteTimer = null;
            }
            this._emit("chat::invite-ended", { chatId: session.chatId, reason: "declined" });
        }

    }

    /**
     * ***************************************************************************
     * Обработка presence собеседника: при появлении в сети — handshake/соединение.
     * @param {unknown} data - Нагрузка события.
     * ***************************************************************************
     */
    private async _handlePresence(data: unknown): Promise<void> {

        if (!isPresencePayload(data) || data.status !== "online") return;

        // Находим чаты с этим устройством собеседника
        for (const session of this.sessions.values()) {
            if (session.peerUserId !== data.user_id || session.peerDeviceId !== data.device_id) continue;
            await this._tryConnect(session);
        }

    }

    /**
     * ***************************************************************************
     * Попытка поднять соединение с собеседником: handshake при отсутствии
     * ключей, соединение — при наличии (инициирует offerer).
     * @param {ChatSession} session - Сессия чата.
     * ***************************************************************************
     */
    private async _tryConnect(session: ChatSession): Promise<void> {

        if (session.closing || session.connectionState === "connected") return;

        // Ключей нет: нужен handshake (его стартует устройство с меньшим device_id).
        // Приглашение не повторяем, если его уже закрыли (все отказали/таймаут)
        if (!session.keys) {
            if (this._isOfferer(this._getSelfDeviceId(), session.peerDeviceId ?? "") && !session.invitePending && !session.inviteStopped) {
                await this._startHandshake(session);
            }
            return;
        }

        // Ключи есть: соединение устанавливает offerer
        if (this._isOfferer(this._getSelfDeviceId(), session.peerDeviceId ?? "") && !session.connection) {
            await this._connect(session);
        }

    }

    // ===========================================================================
    // P2P-соединение
    // ===========================================================================

    /**
     * ***************************************************************************
     * Установка P2P-соединения (DataChannel) с собеседником.
     * @param {ChatSession} session - Сессия чата.
     * ***************************************************************************
     */
    private async _connect(session: ChatSession): Promise<void> {

        // Ключ сессии обязателен: кадры шифруются им
        if (!session.keys) throw new Error("Ключ сессии не вычислен");

        // Устройство собеседника привязано принятием приглашения
        if (!session.peerDeviceId) throw new Error("Устройство собеседника не привязано");

        const selfDeviceId = this._getSelfDeviceId();
        const connection = new SecretConnection({
            chatId: session.chatId,
            sessionKey: session.keys.sessionKey,
            isOfferer: this._isOfferer(selfDeviceId, session.peerDeviceId),
            iceServers: getIceServers(),
            onLocalSignal: (signal) => this._sendSignal(session, signal),
            onControl: (control) => this._onControl(session, control),
            onFileChunk: (fileId, index, chunk) => this._onFileChunk(session, fileId, index, chunk),
            onStateChange: (state) => this._onConnectionState(session, state),
        });
        session.connection = connection;
        await connection.start();

    }

    /**
     * ***************************************************************************
     * Отправка WebRTC-сигнала собеседнику через сервер (без обработки ошибок —
     * доставка best-effort, восстановление — через reconnect).
     * @param {ChatSession} session - Сессия чата.
     * @param {SecretLocalSignal} signal - Локальный сигнал.
     * ***************************************************************************
     */
    private _sendSignal(session: ChatSession, signal: SecretLocalSignal): void {

        // Сигналы уходят устройству собеседника — оно привязано принятием
        const targetDeviceId = session.peerDeviceId;
        if (!targetDeviceId) return;

        signalRequest({
            chat_id: session.chatId,
            target_device_id: targetDeviceId,
            type: signal.type,
            sdp: signal.sdp,
            candidate: signal.candidate,
        }).catch((error) => {
            Logger.error("[app][SecretChatsManager]: ошибка отправки сигнала:", error);
        });
    }

    /**
     * ***************************************************************************
     * Смена состояния P2P-соединения: квитанция ключа на connect, очередь на
     * доставку, реконнект (rekey) после обрыва.
     * @param {ChatSession} session - Сессия чата.
     * @param {SecretConnectionState} state - Новое состояние.
     * ***************************************************************************
     */
    private _onConnectionState(session: ChatSession, state: SecretConnectionState): void {

        session.connectionState = state;
        this._emit("connection::state", { chatId: session.chatId, state });

        // Соединение установлено: подтверждение ключа + доставка очереди
        if (state === "connected") {
            session.reconnectAttempts = 0;
            this._sendKc(session).catch((error) => {
                Logger.error("[app][SecretChatsManager]: ошибка отправки подтверждения ключа:", error);
            });
            this._flushQueue(session.chatId).catch((error) => {
                Logger.error("[app][SecretChatsManager]: ошибка доставки очереди:", error);
            });
            return;
        }

        // Обрыв: закрываем и планируем переподключение с ротацией ключа
        if ((state === "failed" || state === "closed") && !session.closing) {

            // Уведомление close() уже обработанного мёртвого соединения —
            // повторно пытаться переподключаться не нужно
            if (!session.connection && state === "closed") return;

            // Гасим мёртвое соединение: его pc держит сокеты и таймеры, а
            // переиспользовать его после обрыва нельзя
            const dead = session.connection;
            session.connection = null;
            dead?.close();

            if (session.reconnectTimer) clearTimeout(session.reconnectTimer);

            // Экспоненциальный backoff: ровный retry каждые 5 секунд при
            // мёртвом TURN/сети штормит сигналингом и выбивает rate limit
            const delay = Math.min(RECONNECT_DELAY * 2 ** session.reconnectAttempts, RECONNECT_MAX_DELAY);
            session.reconnectAttempts += 1;

            session.reconnectTimer = setTimeout(() => {
                session.reconnectTimer = null;
                this._tryConnect(session).catch((error) => {
                    Logger.error("[app][SecretChatsManager]: ошибка переподключения:", error);
                });
            }, delay);
        }

    }

    /**
     * ***************************************************************************
     * Отправка подтверждения ключа handshake (HMAC) первым кадром соединения.
     * @param {ChatSession} session - Сессия чата.
     * ***************************************************************************
     */
    private async _sendKc(session: ChatSession): Promise<void> {
        if (!session.keys) return;
        const value = await computeConfirmation(session.keys.confirmKey);
        await session.connection?.sendControl({ type: "kc", value: bufferToBase64url(value) });
    }

    // ===========================================================================
    // Входящие данные канала
    // ===========================================================================

    /**
     * ***************************************************************************
     * Обработка control-сообщения от собеседника.
     * @param {ChatSession} session - Сессия чата.
     * @param {SecretControlMessage} control - Control-сообщение.
     * ***************************************************************************
     */
    private async _onControl(session: ChatSession, control: SecretControlMessage): Promise<void> {

        switch (control.type) {

            // Подтверждение ключа: проверяем HMAC (защита от подмены handshake)
            case "kc": {
                if (!session.keys) return;
                const valid = await verifyConfirmation(session.keys.confirmKey, base64urlToBuffer(control.value));
                if (!valid) {
                    Logger.error(`[app][SecretChatsManager][${session.chatId}]: подтверждение ключа не совпало — закрываем соединение`);
                    session.connection?.close();
                }
                return;
            }

            // Новое сообщение: сохраняем vault-шифротекстом и квитируем доставку
            case "msg": {
                await this._saveMessage({
                    id: control.message_id,
                    chat_id: session.chatId,
                    sender: "peer",
                    type: control.msg_type,
                    ciphertext: await Vault.encryptJson(control.payload),
                    status: "delivered",
                    created_at: control.payload.created_at,
                    // Таймер самоуничтожения фиксируется на сообщении
                    // (таймер чата на момент приёма)
                    self_destruct: session.selfDestruct,
                });
                await this._touchChat(session.chatId);
                this._emit("message::added", { chatId: session.chatId, messageId: control.message_id });
                await this.sendReceipt(session.chatId, [control.message_id], "delivered").catch(() => undefined);
                return;
            }

            // Редактирование сообщения собеседником
            case "msg_update": {
                const record = await secretMessagesTable().get(control.message_id);
                if (!record) return;
                await this._saveMessage({ ...record, ciphertext: await Vault.encryptJson(control.payload) });
                this._emit("message::updated", { chatId: session.chatId, messageId: control.message_id });
                return;
            }

            // Удаление сообщения собеседником
            case "msg_remove": {
                this._clearSelfDestruct(control.message_id);
                await secretMessagesTable().delete(control.message_id);
                await secretFilesTable().where("message_id").equals(control.message_id).delete();
                this._emit("message::removed", { chatId: session.chatId, messageId: control.message_id });
                return;
            }

            // Квитанция: обновляем статусы наших сообщений
            case "receipt": {
                for (const messageId of control.message_ids) {
                    await this._updateMessageStatus(messageId, control.status);
                }
                return;
            }

            // Активность собеседника — пробрасываем в UI
            case "typing": {
                this._emit("typing", { chatId: session.chatId, status: control.status });
                return;
            }

            // Объявление файла: готовим сборку чанков
            case "file_offer": {
                session.pendingFiles.set(control.file_id, {
                    meta: control,
                    chunks: new Array<Uint8Array<ArrayBuffer> | undefined>(Math.max(1, Math.ceil(control.size / FILE_CHUNK_SIZE))),
                    received: 0,
                    done: false,
                });
                await this._saveFile({
                    id: control.file_id,
                    message_id: control.message_id,
                    chat_id: session.chatId,
                    name: control.name,
                    mime_type: control.mime_type,
                    size: control.size,
                    duration: control.duration,
                    width: control.width,
                    height: control.height,
                    chunk_salt: createChunkSalt(),
                    chunks: [],
                    status: "receiving",
                });
                return;
            }

            // Файл принят целиком: шифруем vault-ключом и сохраняем
            case "file_done": {
                await this._finishIncomingFile(session, control.file_id);
                return;
            }

            // Отмена передачи файла
            case "file_cancel": {
                session.pendingFiles.delete(control.file_id);
                await secretFilesTable().delete(control.file_id);
                return;
            }

            // ping/pong обрабатывает SecretConnection
            default:
                return;

        }

    }

    /**
     * ***************************************************************************
     * Приём чанка файла из канала.
     * @param {ChatSession} session - Сессия чата.
     * @param {string} fileId - Id файла.
     * @param {number} index - Порядковый номер чанка.
     * @param {Uint8Array} data - Открытые байты чанка.
     * ***************************************************************************
     */
    private async _onFileChunk(session: ChatSession, fileId: string, index: number, data: Uint8Array<ArrayBuffer>): Promise<void> {

        const pending = session.pendingFiles.get(fileId);
        if (!pending) return;

        // Кладём чанк по индексу и считаем прогресс
        pending.chunks[index] = data;
        pending.received += data.length;
        this._emit("file::progress", {
            chatId: session.chatId,
            fileId,
            loaded: pending.received,
            total: pending.meta.size,
        });

        // file_done мог обогнать чанки — последний недостающий закрывает файл
        if (pending.done) await this._finishIncomingFile(session, fileId);

    }

    /**
     * ***************************************************************************
     * Завершение сборки входящего файла: vault-шифрование чанков и сохранение.
     * @param {ChatSession} session - Сессия чата.
     * @param {string} fileId - Id файла.
     * ***************************************************************************
     */
    private async _finishIncomingFile(session: ChatSession, fileId: string): Promise<void> {

        const pending = session.pendingFiles.get(fileId);
        if (!pending) return;

        // file_done мог обогнать тяжёлые чанки (кадры дешифруются асинхронно):
        // финализируем только полный файл, недостающие чанки дорастят его из
        // _onFileChunk. Полнота проверяется обходом по индексам — массив
        // дырявый, и some/forEach такие позиции пропускают
        pending.done = true;
        for (let index = 0; index < pending.chunks.length; index++) {
            if (!pending.chunks[index]) return;
        }
        session.pendingFiles.delete(fileId);

        // Шифруем каждый чанк vault-ключом для локального хранения; чанки
        // ложатся по своим индексам — расшифровка читает их по позиции в
        // массиве, и сдвиг после дырки сломал бы весь файл после неё
        const record = await secretFilesTable().get(fileId);
        const salt = record?.chunk_salt ?? createChunkSalt();
        const chunks: Blob[] = [];
        for (let index = 0; index < pending.chunks.length; index++) {
            const chunk = pending.chunks[index];
            if (!chunk) continue;
            chunks[index] = new Blob([await Vault.encryptChunk(salt, index, chunk)]);
        }

        await this._saveFile({
            id: fileId,
            message_id: pending.meta.message_id,
            chat_id: session.chatId,
            name: pending.meta.name,
            mime_type: pending.meta.mime_type,
            size: pending.meta.size,
            duration: pending.meta.duration,
            width: pending.meta.width,
            height: pending.meta.height,
            chunk_salt: salt,
            chunks,
            status: "complete",
        });
        this._emit("file::done", { chatId: session.chatId, fileId });

    }

    // ===========================================================================
    // Очередь «не доставлено»
    // ===========================================================================

    /**
     * ***************************************************************************
     * Доставка недоставленных сообщений чата (статус queued) при живом соединении.
     * @param {string} chatId - Id чата.
     * ***************************************************************************
     */
    private async _flushQueue(chatId: string): Promise<void> {

        const session = this.sessions.get(chatId);
        if (!session?.connection || session.connectionState !== "connected") return;

        // Отправляем по порядку создания
        const queue = await secretMessagesTable()
            .where("chat_id")
            .equals(chatId)
            .filter((record) => record.status === "queued" || record.status === "failed")
            .sortBy("created_at");

        for (const record of queue) {

            // Payload восстанавливаем из vault-шифротекста
            const payload = parseMessagePayload(await Vault.decryptJson(record.ciphertext));
            await this._updateMessageStatus(record.id, "sending");
            try {
                await session.connection.sendControl({
                    type: "msg",
                    message_id: record.id,
                    msg_type: record.type,
                    payload,
                });
                await this._updateMessageStatus(record.id, "sent");
            } catch (error) {
                Logger.error("[app][SecretChatsManager]: ошибка отправки сообщения:", error);
                await this._updateMessageStatus(record.id, "failed");
            }

        }

    }

    // ===========================================================================
    // Локальное хранилище (IndexedDB, vault-шифротекст)
    // ===========================================================================

    /**
     * ***************************************************************************
     * Сохранение записи чата.
     * @param {SecretChatRecord} record - Запись чата.
     * ***************************************************************************
     */
    private async _saveChat(record: SecretChatRecord): Promise<void> {
        await secretChatsTable().put(record);
    }

    /**
     * ***************************************************************************
     * Сохранение записи сообщения.
     * @param {SecretMessageRecord} record - Запись сообщения.
     * ***************************************************************************
     */
    private async _saveMessage(record: SecretMessageRecord): Promise<void> {
        await secretMessagesTable().put(record);
    }

    /**
     * ***************************************************************************
     * Сохранение записи файла.
     * @param {SecretFileRecord} record - Запись файла.
     * ***************************************************************************
     */
    private async _saveFile(record: SecretFileRecord): Promise<void> {
        await secretFilesTable().put(record);
    }

    /**
     * ***************************************************************************
     * Обновление статуса сообщения (событие для UI).
     * @param {string} messageId - Id сообщения.
     * @param {SecretMessageRecord["status"]} status - Новый статус.
     * ***************************************************************************
     */
    private async _updateMessageStatus(messageId: string, status: SecretMessageRecord["status"]): Promise<void> {
        const record = await secretMessagesTable().get(messageId);
        if (!record) return;
        await this._saveMessage({ ...record, status });
        this._emit("message::updated", { chatId: record.chat_id, messageId });

        // Своё сообщение прочитано собеседником — стартует его
        // самоуничтожение (у отправителя — после receipt: read)
        if (status === "read" && record.sender === "me") {
            await this.touchSelfDestruct(record.chat_id, messageId);
        }
    }

    /**
     * ***************************************************************************
     * Обновление времени последнего сообщения чата.
     * @param {string} chatId - Id чата.
     * ***************************************************************************
     */
    private async _touchChat(chatId: string): Promise<void> {
        const record = await secretChatsTable().get(chatId);
        if (!record) return;
        await this._saveChat({ ...record, last_message_at: Date.now() });
    }

    /**
     * ***************************************************************************
     * Удаление всех локальных данных чата (запись, сообщения, файлы).
     * @param {string} chatId - Id чата.
     * ***************************************************************************
     */
    private async _deleteChatData(chatId: string): Promise<void> {
        await secretMessagesTable().where("chat_id").equals(chatId).delete();
        await secretFilesTable().where("chat_id").equals(chatId).delete();
        await secretChatsTable().delete(chatId);
    }

    /**
     * ***************************************************************************
     * Запись чата по id (для обновления полей).
     * @param {string} chatId - Id чата.
     * @returns {Promise<SecretChatRecord>} - Запись чата.
     * ***************************************************************************
     */
    private async _requireChatRecord(chatId: string): Promise<SecretChatRecord> {
        const record = await secretChatsTable().get(chatId);
        if (!record) throw new Error("Чат не найден в локальном хранилище");
        return record;
    }

    // ===========================================================================
    // Ключи идентичности устройства
    // ===========================================================================

    /**
     * ***************************************************************************
     * Загрузка ключа идентичности из vault-контейнера записи чата.
     * @param {SecretChatRecord} record - Запись чата.
     * @returns {Promise<SecretKeyPair | null>} - Пара ключей или null.
     * ***************************************************************************
     */
    private async _loadIdentity(record: SecretChatRecord): Promise<SecretKeyPair | null> {
        if (!record.keys_encrypted) return null;
        const data = parseKeysData(await Vault.decryptJson(record.keys_encrypted));
        return importIdentityKeyPair(base64urlToBuffer(data.identity_private), base64urlToBuffer(data.identity_public));
    }

    /**
     * ***************************************************************************
     * Получение ключа идентичности устройства: из памяти, из записи чата или
     * генерация нового (первый секретный чат устройства).
     * @param {ChatSession | null} session - Сессия чата (null — новый чат).
     * @returns {Promise<SecretKeyPair>} - Пара ключей идентичности.
     * ***************************************************************************
     */
    private async _ensureIdentity(session: ChatSession | null): Promise<SecretKeyPair> {

        // Уже загружен в память
        const cached = session?.identity ?? this._anySessionIdentity();
        if (cached) return cached;

        // Восстанавливаем из локального хранилища (первая сессия с ключами)
        for (const record of await secretChatsTable().toArray()) {
            const loaded = await this._loadIdentity(record);
            if (loaded) return loaded;
        }

        // Первый секретный чат устройства: генерируем identity-ключ
        Logger.debug("[app][SecretChatsManager]: генерируем ключ идентичности устройства");
        return generateIdentityKeyPair();

    }

    /**
     * ***************************************************************************
     * Ключ идентичности из любой активной сессии памяти.
     * @returns {SecretKeyPair | null} - Пара ключей или null.
     * ***************************************************************************
     */
    private _anySessionIdentity(): SecretKeyPair | null {
        for (const session of this.sessions.values()) {
            if (session.identity) return session.identity;
        }
        return null;
    }

    /**
     * ***************************************************************************
     * Упаковка ключей чата в vault-контейнер (для поля keys_encrypted).
     * @param {ChatSession} session - Сессия чата.
     * @returns {Promise<Uint8Array>} - Vault-шифротекст.
     * ***************************************************************************
     */
    private async _packKeys(session: ChatSession): Promise<Uint8Array<ArrayBuffer>> {
        if (!session.identity) throw new Error("Ключ идентичности не инициализирован");
        return Vault.encryptJson({
            identity_private: bufferToBase64url(await exportIdentityPrivateKey(session.identity)),
            identity_public: bufferToBase64url(session.identity.publicKey),
        });
    }

    // ===========================================================================
    // Вспомогательное
    // ===========================================================================

    /**
     * ***************************************************************************
     * Сессия чата по id.
     * @param {string} chatId - Id чата.
     * @returns {ChatSession} - Сессия чата.
     * ***************************************************************************
     */
    private _requireSession(chatId: string): ChatSession {
        const session = this.sessions.get(chatId);
        if (!session) throw new Error("Секретный чат не найден");
        return session;
    }

    /**
     * ***************************************************************************
     * Поиск неактивного (pending) чата с тем же устройством собеседника —
     * для разрешения гонки двух одновременных приглашений.
     * @param {string} peerUserId - Id собеседника.
     * @param {string} peerDeviceId - Устройство собеседника.
     * @returns {ChatSession | null} - Найденная сессия или null.
     * ***************************************************************************
     */
    private _findPendingChatByPeer(peerUserId: string, peerDeviceId: string): ChatSession | null {
        for (const session of this.sessions.values()) {
            if (session.peerUserId === peerUserId && session.peerDeviceId === peerDeviceId && !session.keys) return session;
        }
        return null;
    }

    /**
     * ***************************************************************************
     * Роль offerer (устанавливает соединение): устройство с меньшим device_id.
     * @param {string} selfDeviceId - Своё устройство (session_id).
     * @param {string} peerDeviceId - Устройство собеседника.
     * @returns {boolean} - true, если мы offerer.
     * ***************************************************************************
     */
    private _isOfferer(selfDeviceId: string, peerDeviceId: string): boolean {
        return selfDeviceId < peerDeviceId;
    }

    /**
     * ***************************************************************************
     * Id текущего устройства (session_id из сессии пользователя).
     * @returns {string} - Id устройства.
     * ***************************************************************************
     */
    private _getSelfDeviceId(): string {
        const sessionId = LocalStorage.sessionId;
        if (!sessionId) throw new Error("Сессия пользователя не инициализирована");
        return sessionId;
    }

    /**
     * ***************************************************************************
     * Подписка на presence собеседника (один раз на пользователя).
     * @param {string} userId - Id собеседника.
     * ***************************************************************************
     */
    private async _subscribePresence(userId: string): Promise<void> {
        if (this.presencePeers.has(userId)) return;
        this.presencePeers.add(userId);
        const answer = await presenceSubscribeRequest(userId).catch((error) => {
            Logger.debug("[app][SecretChatsManager]: ошибка подписки presence:", error);
            return null;
        });

        // Собеседник уже онлайн — сразу пробуем подключиться
        if (!answer?.data?.devices) return;
        for (const session of this.sessions.values()) {
            if (session.peerUserId !== userId) continue;
            if (session.peerDeviceId && answer.data.devices.includes(session.peerDeviceId)) {
                await this._tryConnect(session);
            }
        }
    }

    /**
     * ***************************************************************************
     * Рассылка события менеджера подписчикам (UI).
     * @param {keyof SecretChatsManagerEvents} event - Имя события.
     * @param {object} payload - Нагрузка события.
     * ***************************************************************************
     */
    private _emit<K extends keyof SecretChatsManagerEvents>(event: K, payload: SecretChatsManagerEvents[K]): void {
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

/** Нагрузка события "[secret-chat]: incoming". */
interface IncomingPayload {
    chat_id: string;
    from_user_id: string;
    from_device_id: string;
    identity_key: string;
    ephemeral_key: string;
    self_destruct: SecretSelfDestructValue | null;
}

/**
 * Значение — нагрузка события incoming.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isIncomingPayload(value: unknown): value is IncomingPayload {
    return isRecord(value)
        && typeof value.chat_id === "string"
        && typeof value.from_user_id === "string"
        && typeof value.from_device_id === "string"
        && typeof value.identity_key === "string"
        && typeof value.ephemeral_key === "string"
        && (value.self_destruct === null || typeof value.self_destruct === "string");
}

/** Нагрузка события "[secret-chat]: accepted". */
interface AcceptedPayload {
    chat_id: string;
    from_user_id: string;
    from_device_id: string;
    identity_key: string;
    ephemeral_key: string;
}

/**
 * Значение — нагрузка события accepted.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isAcceptedPayload(value: unknown): value is AcceptedPayload {
    return isRecord(value)
        && typeof value.chat_id === "string"
        && typeof value.from_user_id === "string"
        && typeof value.from_device_id === "string"
        && typeof value.identity_key === "string"
        && typeof value.ephemeral_key === "string";
}

/** Нагрузка события "[secret-chat]: signal". */
interface SignalPayload {
    chat_id: string;
    from_user_id: string;
    from_device_id: string;
    type: "offer" | "answer" | "candidate" | "hangup" | "rekey";
    sdp: string | null;
    candidate: string | null;
}

/**
 * Значение — нагрузка события signal.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isSignalPayload(value: unknown): value is SignalPayload {
    return isRecord(value)
        && typeof value.chat_id === "string"
        && typeof value.from_device_id === "string"
        && (value.type === "offer" || value.type === "answer" || value.type === "candidate" || value.type === "hangup" || value.type === "rekey")
        && (value.sdp === null || typeof value.sdp === "string")
        && (value.candidate === null || typeof value.candidate === "string");
}

/** Нагрузка события "[secret-chat]: closed". */
interface ClosedPayload {
    chat_id: string;
    from_user_id: string;
    from_device_id: string;
}

/**
 * Значение — нагрузка события closed.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isClosedPayload(value: unknown): value is ClosedPayload {
    return isRecord(value)
        && typeof value.chat_id === "string"
        && typeof value.from_user_id === "string"
        && typeof value.from_device_id === "string";
}

/**
 * Нагрузка события "[secret-chat]: declined".
 */
interface DeclinedPayload {
    chat_id: string;
    from_user_id: string;
    from_device_id: string;
    reason: string;
}

/**
 * Значение — нагрузка события declined.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isDeclinedPayload(value: unknown): value is DeclinedPayload {
    return isRecord(value)
        && typeof value.chat_id === "string"
        && typeof value.from_user_id === "string"
        && typeof value.from_device_id === "string"
        && typeof value.reason === "string";
}

/**
 * Причина закрытия приглашения из события (неизвестные значения — как отмена).
 * @param {string} reason - Причина из события.
 * @returns {"declined" | "taken" | "cancelled" | "timeout"} - Известная причина.
 */
function normalizeDeclineReason(reason: string): "declined" | "taken" | "cancelled" | "timeout" {
    if (reason === "declined" || reason === "taken" || reason === "timeout") return reason;
    return "cancelled";
}

/** Нагрузка события "[secret-chat]: presence". */
interface PresencePayload {
    user_id: string;
    device_id: string;
    status: "online" | "offline";
}

/**
 * Значение — нагрузка события presence.
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} - true, если значение похоже на нагрузку.
 */
function isPresencePayload(value: unknown): value is PresencePayload {
    return isRecord(value)
        && typeof value.user_id === "string"
        && typeof value.device_id === "string"
        && (value.status === "online" || value.status === "offline");
}

/**
 * Разбор vault-контейнера ключей чата.
 * @param {unknown} value - Расшифрованное значение.
 * @returns {SecretChatKeysData} - Данные ключей.
 */
function parseKeysData(value: unknown): SecretChatKeysData {
    if (!isRecord(value) || typeof value.identity_private !== "string" || typeof value.identity_public !== "string") {
        throw new Error("Некорректный vault-контейнер ключей чата");
    }
    return { identity_private: value.identity_private, identity_public: value.identity_public };
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
