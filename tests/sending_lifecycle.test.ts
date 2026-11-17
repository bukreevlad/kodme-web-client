// Импортируем bun test
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils (реальный Store — он работает в Bun)
import { Store } from "../js/utils/store.js";

// Импортируем типы
import type { MessageItem } from "../js/forms/messages/components/message.js";
import type { MessageRecord } from "../js/forms/messages/types.js";
import type { Messages } from "../js/forms/messages/index.js";

// ===========================================================================
// Фейки модулей (регистрируются ДО импорта кода под тестом)
// ===========================================================================

/** Строки одной из таблиц локального хранилища (ключ — id записи). */
class FakeTable {

    /** Записи таблицы. */
    rows = new Map<string, Record<string, unknown>>();

    /**
     * Хук перед записью строки (put/update) — тест имитирует гонку «эхо сняло
     * запись, пока ответ сервера ещё обрабатывается».
     */
    beforeWrite: (() => Promise<void>) | null = null;

    /**
     * Положить запись (перезапись по id).
     * @param row - Запись.
     * @returns {Promise<void>}
     */
    async put(row: Record<string, unknown>): Promise<void> {
        await this.beforeWrite?.();
        // invariant: записи сообщений всегда несут строковый id
        this.rows.set(String(row.id), row);
    }

    /**
     * Обновить поля существующей записи (поверхность Table.update из Dexie):
     * отсутствующая запись не создаётся и не «воскресает».
     * @param id - Id записи.
     * @param changes - Изменяемые поля.
     * @returns {Promise<number>} - Число обновлённых записей.
     */
    async update(id: string, changes: Record<string, unknown>): Promise<number> {
        await this.beforeWrite?.();
        const row = this.rows.get(id);
        if (!row) return 0;
        Object.assign(row, changes);
        return 1;
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
     * Положить пачку записей.
     * @param rows - Записи.
     * @returns {Promise<void>}
     */
    async bulkPut(rows: Record<string, unknown>[]): Promise<void> {
        for (const row of rows) await this.put(row);
    }

    /**
     * Удалить пачку записей по id.
     * @param ids - Id записей.
     * @returns {Promise<void>}
     */
    async bulkDelete(ids: string[]): Promise<void> {
        for (const id of ids) this.rows.delete(id);
    }

    /**
     * Все записи таблицы.
     * @returns {Promise<Record<string, unknown>[]>} - Массив записей.
     */
    async toArray(): Promise<Record<string, unknown>[]> {
        return [...this.rows.values()];
    }

    /**
     * Отфильтровать записи (поверхность filter().first() из Dexie).
     * @param predicate - Предикат отбора.
     * @returns Объект запроса с first().
     */
    filter(predicate: (row: Record<string, unknown>) => boolean) {
        return {
            first: async () => [...this.rows.values()].find(predicate)
        };
    }

    /**
     * Запрос по полю (поверхность where().equals()/between() из Dexie).
     * @param field - Имя поля или составного индекса.
     * @returns Объект запроса с equals()/between().
     */
    where(field: string) {
        return {
            equals: (value: unknown) => {

                const matched = () => [...this.rows.values()].filter((row) => row[field] === value);

                return {
                    sortBy: async (key: string) => [...matched()].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""))),
                    delete: async () => {
                        for (const row of matched()) this.rows.delete(String(row.id));
                    },
                    toArray: async () => matched()
                };

            },
            between: (lower: unknown[], upper: unknown[], includeLower = true, includeUpper = true) => {

                // Составной индекс [channel_id+id]: границы — пары [канал, id]
                const matched = () => [...this.rows.values()]
                    .filter((row) => String(row.channel_id) === String(lower[0]))
                    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
                    .filter((row) => {
                        const id = String(row.id);
                        const isAbove = lower[1] === Dexie.minKey
                            || (includeLower ? id >= String(lower[1]) : id > String(lower[1]));
                        const isBelow = upper[1] === Dexie.maxKey
                            || (includeUpper ? id <= String(upper[1]) : id < String(upper[1]));
                        return isAbove && isBelow;
                    });

                return {
                    limit: (count: number) => ({
                        toArray: async () => matched().slice(0, count),
                        reverse: () => ({ toArray: async () => matched().reverse().slice(0, count) })
                    })
                };

            }
        };
    }

}

/** Таблицы локального хранилища (каждому тесту — свежие, см. beforeEach). */
const tables = new Map<string, FakeTable>();

/** Фейковая база: доступ к таблицам по имени (как у IndexedDB.db). */
const fakeDb = {
    table: (name: string): FakeTable => {
        let table = tables.get(name);
        if (!table) {
            table = new FakeTable();
            tables.set(name, table);
        }
        return table;
    }
};

// Мок локального хранилища: таблицы в памяти
mock.module("../js/utils/indexed_db.js", () => ({
    IndexedDB: { db: fakeDb }
}));

// Мок логгера: тишина в выводе тестов
mock.module("../js/utils/logs/logger.js", () => ({
    Logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
    }
}));

// Мок настроек: без localStorage в среде тестов
mock.module("../js/utils/local_storage.js", () => ({
    LocalStorage: { sessionId: "session-1", session: { settings: { user: { decorations: {} } } } }
}));

// Мок тостов: показы в тестах не выполняются
mock.module("../js/components/toast.js", () => ({
    Toast: class {
        static info(): void { }
        static warning(): void { }
        static error(): void { }
    }
}));

mock.module("../js/utils/ui/toast_error.js", () => ({
    toastError: () => undefined
}));

// Мок прогресса: UI-индикаторы в тестах не создаются
mock.module("../js/components/progress.js", () => ({
    ProgressIndicator: class {
        getElement(): null { return null; }
        update(): void { }
        setProcessing(): void { }
        destroy(): void { }
    }
}));

// Мок отмены загрузки и производных ассетов: реальная загрузка в тестах не идёт
mock.module("../js/utils/network/abort_upload.js", () => ({
    abortUpload: async () => undefined
}));

mock.module("../js/utils/media/upload_derived_assets.js", () => ({
    uploadDerivedAssets: async () => undefined,
    matchBlobsToTargets: () => []
}));

// Мок запросов вложений: сервер отвечает готовым документом
mock.module("../js/forms/messages/requests/get_upload_url_attach.js", () => ({
    getUploadAttachURLRequest: async () => ({
        status: true,
        data: {
            document_id: "doc-1",
            targets: [{ kind: "original", path: "p", url: "u", fields: {}, mime_type: "image/jpeg", max_size: 1 }]
        }
    })
}));

mock.module("../js/forms/messages/requests/save_attach.js", () => ({
    saveAttachRequest: async () => ({ status: true, data: { document_id: "doc-1", status: "ready" } })
}));

// Мок запроса истории: история в тестах пуста
mock.module("../js/forms/messages/requests/get_messages_history.js", () => ({
    getMessagesHistoryRequest: async () => ({ status: true, data: [] })
}));

/** Payload'ы всех вызовов `[message]: send` (журнал для проверок). */
const sentPayloads: Record<string, unknown>[] = [];

/** Результат отправки сообщения (ответ сервера на `[message]: send`). */
interface SendAck {
    status: boolean;
    data: { message_id: string };
}

/** Обработчик отправки сообщения: каждый тест задаёт своё поведение. */
let onSend: ((payload: Record<string, unknown>) => Promise<SendAck>) | null = null;

// Мок отправки сообщения: журнал + поведение из теста
mock.module("../js/forms/messages/requests/create_message.js", () => ({
    createMessageRequest: async (data: Record<string, unknown>) => {
        sentPayloads.push(data);
        const handler = onSend;
        if (!handler) throw new Error("тест не задал обработчик отправки");
        return await handler(data);
    }
}));

// Мок уведомлений десктоп-обёртки: в тестах не показываются
mock.module("../js/utils/electron_notifications.js", () => ({
    ElectronNotifications: { show: () => undefined }
}));

// Мок вспомогательных функций главной формы
mock.module("../js/forms/main/functions/session_identity.js", () => ({
    getSessionUserId: () => "user-1",
    getSessionUserDisplayName: () => "Пользователь"
}));

mock.module("../js/forms/main/functions/sort_chat_list.js", () => ({
    sortChatListVisually: () => undefined
}));

mock.module("../js/forms/main/functions/update_folder_unread.js", () => ({
    updateFolderUnread: () => undefined
}));

// Мок списка сообщений: видимость хвоста в тестах не важна
mock.module("../js/forms/messages/functions/message_list.js", () => ({
    MessageList: { isLastItemVisible: () => false }
}));

// Мок главной формы: без инстанса обновления сайдбара пропускаются
mock.module("../js/forms/main/index.js", () => ({
    Main: class { static instance = null; }
}));

// Мок формы сообщений: в тестах форма — пустой класс (открытость
// отслеживает настоящий FormsRegistry — см. openChat ниже)
mock.module("../js/forms/messages/index.js", () => ({
    Messages: class {}
}));

// Импортируем код под тестом ПОСЛЕ моков — он получает фейковые модули
const { sendingMessages } = await import("../js/forms/messages/functions/sending_messages.js");
const { resendMessageHandler } = await import("../js/forms/messages/components/handlers/resend_message.js");
const { applyMessageNew } = await import("../js/forms/main/events/socket/messages/new.js");
const { firstLoadMessages } = await import("../js/forms/messages/functions/first_load_messages.js");
const { FormsRegistry } = await import("../js/core/managers/forms_registry.js");

/**
 * «Открывает» форму чата в реестре открытых форм (так её находит код,
 * раньше читал статический реестр форм).
 * @param channelId - Id канала.
 * @param form - Экземпляр формы.
 */
function openChat(channelId: string, form: object): void {
    FormsRegistry.register({ id: `messages:${channelId}`, instance: form, owner: form, wrap: null, placement: "workspace" });
}

// ===========================================================================
// Вспомогательные функции тестов
// ===========================================================================

/**
 * Отложенный промис: resolve/reject под контролем теста.
 * @returns Объект с промисом и функциями его завершения.
 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {

    let resolveFn: ((value: T) => void) | null = null;
    let rejectFn: ((reason: unknown) => void) | null = null;
    const promise = new Promise<T>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });

    return {
        promise,
        resolve: (value: T) => resolveFn?.(value),
        reject: (reason: unknown) => rejectFn?.(reason)
    };

}

/**
 * Дождаться условия, проверяя его после каждого тика таймера.
 * @param predicate - Проверяемое условие.
 * @returns Promise<void>
 */
async function waitFor(predicate: () => boolean): Promise<void> {

    for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    throw new Error("Ожидаемое условие не наступило");

}

/**
 * Создать фейковую форму сообщений: реальный Store и минимальное окружение.
 * @returns Объект формы (приведён к типу Messages).
 */
function createForm(): Messages {

    const form = {
        channelId: "ch-1",
        store: new Store<MessageRecord>(),
        channel: { id: "ch-1", display_name: "чат", is_subscribed: true },
        list: { style: {}, innerHTML: "", querySelector: () => null },
        listScrollManager: { enabled: true },
        osListScrollInstance: null,
        observer: null,
        uploadAbort: null,
        unreadMarkerBeforeId: null,
        unreadMarkerObserver: null,
        _lastInsertDirection: null,
        _stickToBottom: false
    };

    // invariant: тесту нужен объект с поверхностью формы, а не её конструктор
    return form as unknown as Messages;

}

/**
 * Локальный id исходящего (= random_id): UUIDv7-подобная строка.
 * @param tail - Хвост id (уникален в пределах файла тестов).
 * @returns Id записи.
 */
function localId(tail: string): string {
    return `00000000-0000-7000-8000-${tail.padStart(12, "0")}`;
}

/**
 * Исходящее сообщение: запись очереди (полные данные вложений).
 * @param id - Локальный id (= random_id).
 * @param [withFile] - Добавить вложение с локальным файлом.
 * @returns Запись сообщения.
 */
function makePendingMessage(id: string, withFile = false): MessageRecord {

    return {
        id,
        channel_id: "ch-1",
        text: withFile ? "" : "привет",
        attachments: withFile
            ? {
                "file-1": {
                    name: "photo.jpg",
                    size: 3,
                    _file: new File(["abc"], "photo.jpg", { type: "image/jpeg" })
                }
            }
            : [],
        is_pending: true,
        is_temporary: true
    };

}

// ===========================================================================
// Тесты
// ===========================================================================

beforeEach(() => {
    tables.clear();
    FormsRegistry.clear();
    sentPayloads.length = 0;
    onSend = null;
});

describe("жизненный цикл отправки сообщений", () => {

    test("«ack раньше эха»: подтверждение пишется в запись очереди, полное сообщение — только из эха", async () => {

        const form = createForm();
        const id = localId("1");

        // Исходящее: запись очереди + строка в сторе (как при создании)
        const pendingRow = makePendingMessage(id);
        await fakeDb.table("pending_messages").put(pendingRow);
        form.store.add(pendingRow);

        onSend = async () => ({ status: true, data: { message_id: "server-1" } });
        await sendingMessages(form);

        // Запрос ушёл с клиентским ключом идемпотентности
        expect(sentPayloads.length).toBe(1);
        expect(sentPayloads[0]?.["random_id"]).toBe(id);
        expect(sentPayloads[0]?.["channel_id"]).toBe("ch-1");
        expect(sentPayloads[0]?.["text"]).toBe("привет");

        // Запись очереди подтверждена (флаги сняты) и живёт до прихода
        // полного сообщения
        const confirmed = await fakeDb.table("pending_messages").get(id);
        expect(confirmed?.["is_pending"]).toBe(false);
        expect(confirmed?.["is_temporary"]).toBe(false);

        // Подтверждённое сообщение сразу выглядит отправленным (без «часиков»)
        const storeItem = form.store.get("server-1");
        expect(storeItem).toBeDefined();
        expect(storeItem?.is_pending).toBe(false);

        // Единственный писатель таблицы messages — обработчик записи сообщения
        expect((await fakeDb.table("messages").toArray()).length).toBe(0);

        // Эхо приходит ПОСЛЕ ответа сервера
        await applyMessageNew({
            id: "server-1",
            random_id: id,
            channel_id: "ch-1",
            author_id: "user-1",
            text: "привет",
            created_at: new Date().toISOString()
        });

        // Полное сообщение записано, запись очереди снята по random_id
        expect(await fakeDb.table("messages").get("server-1")).toBeDefined();
        expect(await fakeDb.table("pending_messages").get(id)).toBeUndefined();

        // Дубля в сторе нет
        expect(form.store.getAll().length).toBe(1);

    });

    test("«эхо раньше ack»: эхо снимает очередь по random_id, ответ сервера дубль не создаёт", async () => {

        const form = createForm();
        const id = localId("2");
        openChat("ch-1", form);

        const pendingRow = makePendingMessage(id);
        await fakeDb.table("pending_messages").put(pendingRow);
        form.store.add(pendingRow);

        // Ответ сервера «подвешен» — эхо успевает прийти раньше него
        const gate = deferred<SendAck>();
        onSend = () => gate.promise;

        const run = sendingMessages(form);
        await waitFor(() => sentPayloads.length === 1);

        // Эхо приходит первым: оно же пишет полное сообщение и снимает очередь
        await applyMessageNew({
            id: "server-2",
            random_id: id,
            channel_id: "ch-1",
            author_id: "user-1",
            text: "привет",
            created_at: new Date().toISOString()
        });

        expect(await fakeDb.table("messages").get("server-2")).toBeDefined();
        expect(await fakeDb.table("pending_messages").get(id)).toBeUndefined();

        // Эхо уже переименовало локальную запись по random_id
        expect(form.store.get(id)).toBeUndefined();
        expect(form.store.get("server-2")).toBeDefined();

        // Теперь приходит ответ сервера — он идемпотентен
        gate.resolve({ status: true, data: { message_id: "server-2" } });
        await run;

        // Ни дубля в сторе, ни повторной записи в очередь
        expect(form.store.getAll().length).toBe(1);
        expect((await fakeDb.table("messages").toArray()).length).toBe(1);
        expect((await fakeDb.table("pending_messages").toArray()).length).toBe(0);

    });

    test("«ресенд без дублей»: повтор идёт с тем же random_id, подтверждённые записи очередь не трогает", async () => {

        const form = createForm();
        const id = localId("3");

        const pendingRow = makePendingMessage(id);
        await fakeDb.table("pending_messages").put(pendingRow);
        form.store.add(pendingRow);

        // Первая попытка падает валидационной ошибкой, повтор успешен:
        // сервер дедуплицирует по random_id и отвечает тем же message_id
        let attempts = 0;
        onSend = async () => {
            attempts += 1;
            if (attempts === 1) throw new Error("TEXT_TOO_LONG :: 122012");
            return { status: true, data: { message_id: "server-3" } };
        };

        await sendingMessages(form);

        // Ошибка помечена на записи очереди, сообщение не потеряно
        expect(sentPayloads.length).toBe(1);
        const failed = await fakeDb.table("pending_messages").get(id);
        expect(failed?.["is_error_sending"]).toBe(true);
        expect(failed?.["is_pending"]).toBe(true);

        // Повторная отправка (кнопка «Повторить»)
        // invariant: строка очереди — это запись сообщения формы
        const messageItem = { data: { id }, form } as unknown as MessageItem;
        await resendMessageHandler(messageItem);
        await waitFor(() => sentPayloads.length === 2);

        // Оба запроса ушли с одним и тем же random_id
        expect(sentPayloads[0]?.["random_id"]).toBe(id);
        expect(sentPayloads[1]?.["random_id"]).toBe(id);

        // Дубля нет: одна запись в сторе под серверным id
        expect(form.store.getAll().length).toBe(1);
        expect(form.store.get("server-3")).toBeDefined();

        // Запись очереди подтверждена — повторов больше не будет
        const confirmed = await fakeDb.table("pending_messages").get(id);
        expect(confirmed?.["is_pending"]).toBe(false);

        await sendingMessages(form);
        expect(sentPayloads.length).toBe(2);

    });

    test("«рендер pending до подтверждения»: неотправленное видно при открытии формы", async () => {

        const form = createForm();
        const id = localId("4");

        // Перезапуск приложения: очередь живёт в IndexedDB, в сторе пусто
        await fakeDb.table("pending_messages").put(makePendingMessage(id));

        await firstLoadMessages(form);

        // Запись очереди отрисована в ленте до подтверждения сервера
        const items = form.store.getAll();
        expect(items.length).toBe(1);
        expect(items[0]?.id).toBe(id);
        expect(items[0]?.is_pending).toBe(true);

    });

    test("вложения записи очереди не затираются: полные данные хранятся до эха", async () => {

        const form = createForm();
        const id = localId("5");

        // Вложение с локальным файлом (полная форма записи очереди)
        const pendingRow = makePendingMessage(id, true);
        await fakeDb.table("pending_messages").put(pendingRow);
        form.store.add(makePendingMessage(id, true));

        onSend = async () => ({ status: true, data: { message_id: "server-5" } });
        await sendingMessages(form);

        // Payload запроса несёт мап {document_id: {file_name}}
        expect(sentPayloads[0]?.["attachments"]).toEqual({ "doc-1": { file_name: "photo.jpg" } });

        // Запись очереди по-прежнему хранит полные данные вложения
        const row = await fakeDb.table("pending_messages").get(id);
        // invariant: вложения записи — объект-мап по локальному ключу файла
        const rowAttachments = row?.["attachments"] as Record<string, unknown>;
        expect(rowAttachments["file-1"]).toBeDefined();

    });

    test("гонка «эхо сняло запись во время ответа сервера»: запись не воскресает", async () => {

        const form = createForm();
        const id = localId("6");
        openChat("ch-1", form);

        const pendingRow = makePendingMessage(id);
        await fakeDb.table("pending_messages").put(pendingRow);
        form.store.add(pendingRow);

        // Ответ сервера «подвешен»
        const gate = deferred<SendAck>();
        onSend = () => gate.promise;

        const run = sendingMessages(form);
        await waitFor(() => sentPayloads.length === 1);

        // Паркуем запись ответа сервера до изменения базы: в этом окне
        // эхо успевает снять запись очереди
        let writeStarted = false;
        let releaseWrite: () => void = () => undefined;
        fakeDb.table("pending_messages").beforeWrite = async () => {
            writeStarted = true;
            await new Promise<void>((resolve) => { releaseWrite = resolve; });
        };

        gate.resolve({ status: true, data: { message_id: "server-6" } });
        await waitFor(() => writeStarted);

        // Эхо приходит, пока ответ сервера ещё обрабатывается
        await applyMessageNew({
            id: "server-6",
            random_id: id,
            channel_id: "ch-1",
            author_id: "user-1",
            text: "привет",
            created_at: new Date().toISOString()
        });
        expect(await fakeDb.table("pending_messages").get(id)).toBeUndefined();

        releaseWrite();
        await run;

        // Очередь пуста, сообщение в сторе одно
        expect((await fakeDb.table("pending_messages").toArray()).length).toBe(0);
        expect(form.store.getAll().length).toBe(1);
        expect((await fakeDb.table("messages").toArray()).length).toBe(1);

    });

});
