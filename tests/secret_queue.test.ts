// Импортируем bun test
import { afterEach, describe, expect, mock, test } from "bun:test";

// Импортируем utils (реальная крипто — она работает в Bun)
import { genUuidv7 } from "../js/utils/crypto/gen_uuidv7.js";
import { bufferToBase64url } from "../js/utils/helpers/webauthn.js";
import { generateEphemeralKeyPair, generateIdentityKeyPair } from "../js/utils/crypto/secret_crypto.js";

// ===========================================================================
// Фейки модулей менеджера (регистрируются ДО его импорта)
// ===========================================================================

/** Строки одной из таблиц локального хранилища (ключ — id записи). */
class FakeTable {

    /** Записи таблицы. */
    rows = new Map<string, Record<string, unknown>>();

    /**
     * Положить запись (перезапись по id).
     * @param row - Запись.
     * @returns {Promise<void>}
     */
    async put(row: Record<string, unknown>): Promise<void> {
        // invariant: записи менеджера всегда несут строковый id
        this.rows.set(String(row.id), row);
    }

    /**
     * Прочитать запись по id.
     * @param id - Id записи.
     * @returns {Promise<Record<string, unknown> | undefined>} - Запись либо undefined.
     */
    async get(id: string): Promise<Record<string, unknown> | undefined> {
        return this.rows.get(id);
    }

    /**
     * Удалить запись по id.
     * @param id - Id записи.
     * @returns {Promise<void>}
     */
    async delete(id: string): Promise<void> {
        this.rows.delete(id);
    }

    /**
     * Все записи таблицы.
     * @returns {Promise<Record<string, unknown>[]>} - Массив записей.
     */
    async toArray(): Promise<Record<string, unknown>[]> {
        return [...this.rows.values()];
    }

    /**
     * Очистить таблицу.
     * @returns {Promise<void>}
     */
    async clear(): Promise<void> {
        this.rows.clear();
    }

    /**
     * Запрос по полю (минимальная поверхность where().equals() из Dexie).
     * @param field - Имя поля.
     * @returns Объект запроса с filter/sortBy/delete/toArray.
     */
    where(field: string) {
        return {
            equals: (value: unknown) => {

                const matched = () => [...this.rows.values()].filter((row) => row[field] === value);

                return {
                    filter: (predicate: (row: Record<string, unknown>) => boolean) => ({
                        sortBy: async (key: string) => [...matched().filter(predicate)].sort((a, b) => Number(a[key] ?? 0) - Number(b[key] ?? 0)),
                    }),
                    delete: async () => {
                        for (const row of matched()) this.rows.delete(String(row.id));
                    },
                    toArray: async () => matched(),
                };

            },
        };
    }

}

// Таблицы локального хранилища (каждому тесту — свежие, см. beforeEach)
const chatsTable = new FakeTable();
const messagesTable = new FakeTable();
const filesTable = new FakeTable();

/** Обработчики сокет-событий, зарегистрированные менеджером (ключ — имя события). */
const socketHandlers = new Map<string, (data: unknown) => void>();

/** Исходящие control-кадры и чанки на фейковом соединении. */
const sentControls: Record<string, unknown>[] = [];
const sentChunks: { fileId: string; index: number; data: Uint8Array }[] = [];

/** Опции последнего созданного соединения (для вызова колбэков менеджера). */
let lastConnectionOptions: {
    onControl: (control: Record<string, unknown>) => Promise<void>;
    onStateChange: (state: string) => void;
} | null = null;

/** Флаг: следующая отправка control-кадра бросает ошибку (обрыв канала). */
let failNextSendControl = false;

// Мок сокета: on/off запоминают обработчики, запросы всегда успешны
mock.module("../js/config/socket.js", () => ({
    Socket: {
        client: {
            on: (event: string, handler: (data: unknown) => void) => {
                socketHandlers.set(event, handler);
            },
            off: () => undefined,
            timeout: () => ({ emitWithAck: async () => ({ status: true, data: {} }) }),
        },
    },
}));

// Мок запросов сигналинга: доставка всегда успешна (presence — онлайн)
mock.module("../js/utils/secret_chats/secret_chats_requests.js", () => ({
    inviteRequest: async () => ({ status: true, data: { delivered: true } }),
    acceptRequest: async () => ({ status: true, data: { delivered: true } }),
    signalRequest: async () => ({ status: true, data: { delivered: true } }),
    closeRequest: async () => ({ status: true, data: { delivered: true } }),
    declineRequest: async () => ({ status: true, data: { delivered: true } }),
    presenceSubscribeRequest: async () => ({ status: true, data: { user_id: "peer-user", devices: ["peer-device"] } }),
    presenceUnsubscribeRequest: async () => ({ status: true, data: { user_id: "peer-user" } }),
}));

// Мок локального хранилища: id устройства «меньше» id собеседника (мы — offerer)
mock.module("../js/utils/local_storage.js", () => ({
    LocalStorage: {
        sessionId: "00000000-0000-7000-8000-000000000001",
        session: { server: { web_rtc: { ice_servers: [] } } },
    },
}));

// Мок хранилища секретных чатов: таблицы в памяти
mock.module("../js/utils/secret_chats/secret_chats_db.js", () => ({
    secretChatsTable: () => chatsTable,
    secretMessagesTable: () => messagesTable,
    secretFilesTable: () => filesTable,
}));

// Мок vault: шифрование прозрачное (JSON ↔ Uint8Array), чанки без изменения
mock.module("../js/utils/crypto/vault.js", () => ({
    Vault: {
        key: null,
        storageKeyName: (sessionId: string) => `vault::${sessionId}`,
        initial: async () => undefined,
        delete: () => undefined,
        encryptJson: async (value: unknown) => new TextEncoder().encode(JSON.stringify(value)),
        decryptJson: async (payload: Uint8Array) => JSON.parse(new TextDecoder().decode(payload)),
        encryptChunk: async (_salt: Uint8Array, _index: number, data: Uint8Array) => data,
        decryptChunk: async (_salt: Uint8Array, _index: number, data: Uint8Array) => data,
    },
}));

// Мок соединения: записывает отправленное, колбэки менеджера доступны тестам
mock.module("../js/utils/secret_chats/secret_connection.js", () => ({
    SecretConnection: class {

        /**
         * Создание фейкового соединения (запоминает опции менеджера).
         * @param options - Опции соединения.
         */
        constructor(options: {
            onControl: (control: Record<string, unknown>) => Promise<void>;
            onStateChange: (state: string) => void;
        }) {
            lastConnectionOptions = options;
        }

        /** Запуск соединения (без WebRTC). */
        async start(): Promise<void> { }

        /** Закрытие соединения (без колбэков — без лишних реконнектов в тестах). */
        close(): void { }

        /**
         * Отправка control-кадра (запоминается; msg-кадр бросает ошибку
         * по флагу — имитация обрыва канала).
         * @param control - Control-сообщение.
         * @returns {Promise<void>}
         */
        async sendControl(control: Record<string, unknown>): Promise<void> {
            if (failNextSendControl && control.type === "msg") {
                failNextSendControl = false;
                throw new Error("канал закрыт");
            }
            sentControls.push(control);
        }

        /**
         * Отправка чанка файла (запоминается).
         * @param fileId - Id файла.
         * @param index - Номер чанка.
         * @param data - Данные чанка.
         * @returns {Promise<void>}
         */
        async sendFileChunk(fileId: string, index: number, data: Uint8Array): Promise<void> {
            sentChunks.push({ fileId, index, data });
        }

        /** Применение входящего сигнала (без WebRTC). */
        async handleSignal(): Promise<void> { }

    },
}));

// Импортируем менеджер ПОСЛЕ моков — он получает фейковые модули
const { SecretChatsManager } = await import("../js/core/managers/secret_chats_manager.js");

// ===========================================================================
// Вспомогательные функции тестов
// ===========================================================================

/**
 * Ожидание условия с таймаутом (крипто-операции менеджера асинхронны —
 * один тик event loop их не покрывает).
 * @param predicate - Проверяемое условие.
 * @param [timeoutMs=2000] - Таймаут ожидания (мс).
 * @returns {Promise<void>}
 */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {

    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Таймаут ожидания условия");
        await Bun.sleep(5);
    }

}

/**
 * Активация чата (handshake принят): ключи собеседника настоящие —
 * менеджер вычисляет ключ сессии реальной криптой.
 * @param chatId - Id чата.
 * @returns {Promise<void>}
 */
async function activateChat(chatId: string): Promise<void> {

    const peerIdentity = await generateIdentityKeyPair();
    const peerEphemeral = await generateEphemeralKeyPair();
    const accepted = socketHandlers.get("[secret-chat]: accepted");
    if (!accepted) throw new Error("Менеджер не подписался на accepted");

    accepted({
        chat_id: chatId,
        from_user_id: "peer-user",
        from_device_id: "ffffffff-ffff-7fff-8fff-ffffffffffff",
        identity_key: bufferToBase64url(peerIdentity.publicKey),
        ephemeral_key: bufferToBase64url(peerEphemeral.publicKey),
    });

    // Handshake завершается созданием соединения (крипто — не один тик)
    await waitFor(() => lastConnectionOptions !== null);

}

/** Записи сообщений таблицы в порядке вставки. */
function messageRows(): Record<string, unknown>[] {
    return [...messagesTable.rows.values()];
}

/**
 * ***************************************************************************
 * Секретные чаты: очередь «не доставлено» и статусы сообщений.
 * Проверяется на реальном менеджере: транспорт и хранилище замоканы,
 * крипто и логика статусов — настоящие.
 * ***************************************************************************
 */
describe("секретные чаты: очередь и статусы сообщений", () => {

    // Каждому тесту — чистые таблицы, очередь отправки и менеджер
    afterEach(() => {
        SecretChatsManager.destroy();
        chatsTable.clear();
        messagesTable.clear();
        filesTable.clear();
        socketHandlers.clear();
        sentControls.length = 0;
        sentChunks.length = 0;
        lastConnectionOptions = null;
        failNextSendControl = false;
    });

    /**
     * ***************************************************************************
     * Без соединения сообщение копится в очереди со статусом queued.
     * ***************************************************************************
     */
    test("без соединения сообщение остаётся в очереди (queued)", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");

        const messageId = await manager.sendMessage(chatId, "text", { text: "привет" });

        // Запись сохранена со статусом queued, ничего не отправлено
        const row = messageRows().find((item) => item.id === messageId);
        expect(row?.status).toBe("queued");
        expect(sentControls.filter((item) => item.type === "msg")).toHaveLength(0);

    });

    /**
     * ***************************************************************************
     * При подключении очередь уходит в порядке создания, статусы — sent.
     * ***************************************************************************
     */
    test("очередь уходит по порядку при подключении, статусы sent", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");
        await activateChat(chatId);

        const first = await manager.sendMessage(chatId, "text", { text: "первое" });
        const second = await manager.sendMessage(chatId, "text", { text: "второе" });

        // До подключения очередь не уходит
        expect(sentControls.filter((item) => item.type === "msg")).toHaveLength(0);

        // Соединение установлено — очередь доставляется
        lastConnectionOptions?.onStateChange("connected");
        await waitFor(() => messageRows().every((row) => row.status === "sent"));

        const messages = sentControls.filter((item) => item.type === "msg");
        expect(messages.map((item) => item.message_id)).toEqual([first, second]);
        expect(messageRows().map((row) => row.status)).toEqual(["sent", "sent"]);

    });

    /**
     * ***************************************************************************
     * Квитанции переводят статусы delivered и read.
     * ***************************************************************************
     */
    test("квитанции переводят статусы delivered → read", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");
        await activateChat(chatId);
        lastConnectionOptions?.onStateChange("connected");

        const states: string[] = [];
        manager.on("message::updated", ({ messageId }) => {
            states.push(String(messageRows().find((row) => row.id === messageId)?.status));
        });

        const messageId = await manager.sendMessage(chatId, "text", { text: "привет" });

        await lastConnectionOptions?.onControl({ type: "receipt", message_ids: [messageId], status: "delivered" });
        await lastConnectionOptions?.onControl({ type: "receipt", message_ids: [messageId], status: "read" });

        const row = messageRows().find((item) => item.id === messageId);
        expect(row?.status).toBe("read");
        expect(states).toContain("delivered");
        expect(states).toContain("read");

    });

    /**
     * ***************************************************************************
     * Ошибка отправки помечает сообщение failed, повтор при переподключении
     * уходит снова (повторная попытка для failed).
     * ***************************************************************************
     */
    test("ошибка отправки даёт failed, повтор при переподключении проходит", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");
        await activateChat(chatId);

        const messageId = await manager.sendMessage(chatId, "text", { text: "привет" });

        // Канал бросает ошибку — сообщение падает в failed
        failNextSendControl = true;
        lastConnectionOptions?.onStateChange("connected");
        await waitFor(() => messageRows().find((item) => item.id === messageId)?.status === "failed");

        // Повторное подключение забирает failed из очереди
        lastConnectionOptions?.onStateChange("connected");
        await waitFor(() => messageRows().find((item) => item.id === messageId)?.status === "sent");

    });

    /**
     * ***************************************************************************
     * Входящее сообщение сохраняется со статусом delivered и квитируется.
     * ***************************************************************************
     */
    test("входящее сообщение сохраняется delivered и квитируется", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");
        await activateChat(chatId);
        lastConnectionOptions?.onStateChange("connected");

        const incomingId = genUuidv7();
        await lastConnectionOptions?.onControl({
            type: "msg",
            message_id: incomingId,
            msg_type: "text",
            payload: { text: "входящее", file_id: null, files: null, reply_to: null, duration: null, created_at: Date.now() },
        });

        const row = messageRows().find((item) => item.id === incomingId);
        expect(row?.status).toBe("delivered");
        expect(row?.sender).toBe("peer");

        // Квитанция доставки ушла отправителю (по типу — kc уходит фоном)
        const receipts = sentControls.filter((item) => item.type === "receipt");
        expect(receipts.at(-1)).toMatchObject({ message_ids: [incomingId], status: "delivered" });

    });

    /**
     * ***************************************************************************
     * sendReceipt отправляет квитанцию через соединение.
     * ***************************************************************************
     */
    test("sendReceipt отправляет квитанцию собеседнику", async () => {

        const manager = SecretChatsManager.initial();
        const chatId = await manager.createChat("peer-user", null);
        if (!chatId) throw new Error("Чат не создан: собеседник офлайн");
        await activateChat(chatId);
        lastConnectionOptions?.onStateChange("connected");

        await manager.sendReceipt(chatId, ["msg-1", "msg-2"], "read");

        const receipts = sentControls.filter((item) => item.type === "receipt");
        expect(receipts.at(-1)).toMatchObject({
            type: "receipt",
            message_ids: ["msg-1", "msg-2"],
            status: "read",
        });

    });

    /**
     * ***************************************************************************
     * Входящее приглашение не принимается само: ждёт решения пользователя
     * (acceptChat создаёт чат на выбранном устройстве, declineChat закрывает).
     * ***************************************************************************
     */
    test("приглашение ждёт решения: acceptChat/declineChat", async () => {

        const manager = SecretChatsManager.initial();

        // Собеседник зовёт в чат (реальные ключи handshake)
        const peerIdentity = await generateIdentityKeyPair();
        const peerEphemeral = await generateEphemeralKeyPair();
        const incoming = socketHandlers.get("[secret-chat]: incoming");
        if (!incoming) throw new Error("Менеджер не подписался на incoming");

        const ended: string[] = [];
        manager.on("chat::invite-ended", ({ reason }) => ended.push(reason));

        // Первое приглашение отклоняем — чата не появляется
        const declinedChatId = genUuidv7();
        incoming({
            chat_id: declinedChatId,
            from_user_id: "peer-user",
            from_device_id: "ffffffff-ffff-7fff-8fff-ffffffffffff",
            identity_key: bufferToBase64url(peerIdentity.publicKey),
            ephemeral_key: bufferToBase64url(peerEphemeral.publicKey),
            self_destruct: null,
        });
        expect(chatsTable.rows.has(declinedChatId)).toBe(false);

        await manager.declineChat(declinedChatId);
        expect(ended).toEqual(["declined"]);

        // Второе приглашение принимаем — чат создаётся на этом устройстве
        const acceptedChatId = genUuidv7();
        incoming({
            chat_id: acceptedChatId,
            from_user_id: "peer-user",
            from_device_id: "ffffffff-ffff-7fff-8fff-ffffffffffff",
            identity_key: bufferToBase64url(peerIdentity.publicKey),
            ephemeral_key: bufferToBase64url(peerEphemeral.publicKey),
            self_destruct: null,
        });
        await manager.acceptChat(acceptedChatId);

        const row = await chatsTable.get(acceptedChatId);
        expect(row?.status).toBe("active");
        expect(row?.peer_device_id).toBe("ffffffff-ffff-7fff-8fff-ffffffffffff");

    });

});
