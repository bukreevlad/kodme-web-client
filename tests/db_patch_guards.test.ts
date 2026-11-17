// Тесты патчей IndexedDB: update() не «воскрешает» запись, удалённую
// параллельно с обновлением, и не затирает чужие поля записи.

// Импортируем bun test
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Импортируем типы
import type { AsyncQueue } from "../js/utils/helpers/async_queue.js";

// ===========================================================================
// Фейки модулей (регистрируются ДО импорта кода под тестом)
// ===========================================================================

/** Строки одной из таблиц локального хранилища (ключ — id записи). */
class FakeTable {

    /** Записи таблицы. */
    rows = new Map<string, Record<string, unknown>>();

    /**
     * Хук перед записью строки (put/update) — тест имитирует удаление
     * записи параллельно с обновлением.
     */
    beforeWrite: (() => Promise<void>) | null = null;

    /**
     * Положить запись (перезапись по id).
     * @param row - Запись.
     * @returns {Promise<void>}
     */
    async put(row: Record<string, unknown>): Promise<void> {
        await this.beforeWrite?.();
        // invariant: записи всегда несут строковый id
        this.rows.set(String(row.id), row);
    }

    /**
     * Обновить поля существующей записи (поверхность Table.update из Dexie):
     * отсутствующая запись не создаётся.
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
     * Все записи таблицы.
     * @returns {Promise<Record<string, unknown>[]>} - Массив записей.
     */
    async toArray(): Promise<Record<string, unknown>[]> {
        return [...this.rows.values()];
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

// Мок тостов: показы в тестах не выполняются
mock.module("../js/components/toast.js", () => ({
    Toast: class {
        static info(): void { }
        static warning(): void { }
        static error(): void { }
    }
}));

// Мок форм: обработчики работают только с их реестрами
mock.module("../js/forms/main/index.js", () => ({
    Main: class { static instance = null; }
}));

mock.module("../js/forms/messages/index.js", () => ({
    Messages: class { static instances = new Map(); }
}));

mock.module("../js/forms/comments/index.js", () => ({
    Comments: class { static instances = new Map(); }
}));

mock.module("../js/forms/group-topics/index.js", () => ({
    GroupTopics: class { static instances = new Map(); }
}));

// Мок состояния ветки комментариев: побочных эффектов нет
mock.module("../js/forms/comments/functions/push_state.js", () => ({
    setCommentingAllowed: () => undefined
}));

/** Обработчики сокет-событий, зарегистрированные подписками (ключ — событие). */
const socketHandlers = new Map<string, (data: unknown, timestamp: number) => void>();

// Мок сокета: on запоминает обработчики
mock.module("../js/config/socket.js", () => ({
    Socket: {
        client: {
            on: (event: string, handler: (data: unknown, timestamp: number) => void) => {
                socketHandlers.set(event, handler);
            },
            off: () => undefined
        }
    }
}));

// Импортируем код под тестом ПОСЛЕ моков — он получает фейковые модули
const { applyCommentsCountDelta } = await import("../js/forms/main/events/socket/comments/count_comments.js");
const { subscribeCommentsUpdatePostCommenting } = await import("../js/forms/main/events/socket/comments/update_post_commenting.js");
const { applyChannelUpdate } = await import("../js/forms/main/events/socket/channels/update.js");

// ===========================================================================
// Вспомогательные функции тестов
// ===========================================================================

/**
 * Запустить обработчик сокет-события и дождаться конца его задачи в очереди.
 * @param event - Имя сокет-события.
 * @param data - Нагрузка события.
 * @returns Promise<void>
 */
async function emit(event: string, data: unknown): Promise<void> {

    // Очередь с реальным промисом: enqueue возвращает задачу
    let enqueued: Promise<unknown> | null = null;
    const asyncQueue = {
        enqueue: <T>(task: () => Promise<T> | T) => {
            enqueued = Promise.resolve(task());
            return enqueued;
        }
    };

    // invariant: подписке нужен объект с поверхностью AsyncQueue
    subscribeCommentsUpdatePostCommenting(asyncQueue as unknown as AsyncQueue);

    const handler = socketHandlers.get(event);
    if (!handler) throw new Error(`обработчик события ${event} не зарегистрирован`);

    handler(data, Date.now());
    await enqueued;

}

// ===========================================================================
// Тесты
// ===========================================================================

beforeEach(() => {
    tables.clear();
    socketHandlers.clear();
});

describe("патчи IndexedDB не воскрешают и не затирают", () => {

    test("гонка «запись удалили параллельно с патчом»: запись не воскресает", async () => {

        await fakeDb.table("messages").put({ id: "post-1", text: "привет", count_comments: 2 });

        // Удаление приходит ровно в окне записи (как параллельный пуш удаления)
        fakeDb.table("messages").beforeWrite = async () => {
            await fakeDb.table("messages").delete("post-1");
        };

        await applyCommentsCountDelta("post-1", "ch-1", 1);

        expect((await fakeDb.table("messages").toArray()).length).toBe(0);

    });

    test("счётчик комментариев патчится отдельно: чужие поля сохраняются", async () => {

        await fakeDb.table("messages").put({ id: "post-2", text: "привет", count_comments: 2 });

        await applyCommentsCountDelta("post-2", "ch-1", 1);

        const row = await fakeDb.table("messages").get("post-2");
        expect(row?.["count_comments"]).toBe(3);
        expect(row?.["text"]).toBe("привет");

    });

    test("[comment]: update post commenting — удалённый параллельно пост не воскресает", async () => {

        await fakeDb.table("messages").put({ id: "post-3", text: "привет", is_commenting: null });

        fakeDb.table("messages").beforeWrite = async () => {
            await fakeDb.table("messages").delete("post-3");
        };

        await emit("[comment]: update post commenting", { channel_id: "ch-1", message_id: "post-3", is_commenting: false });

        expect((await fakeDb.table("messages").toArray()).length).toBe(0);

    });

    test("[comment]: update post commenting — патчится только is_commenting", async () => {

        await fakeDb.table("messages").put({ id: "post-4", text: "привет", is_commenting: null, count_comments: 5 });

        await emit("[comment]: update post commenting", { channel_id: "ch-1", message_id: "post-4", is_commenting: false });

        const row = await fakeDb.table("messages").get("post-4");
        expect(row?.["is_commenting"]).toBe(false);
        expect(row?.["text"]).toBe("привет");
        expect(row?.["count_comments"]).toBe(5);

    });

    test("обновление канала не затирает его локальные поля", async () => {

        // last_pts — локальное поле синхронизации: его нет в обновлении с сервера
        await fakeDb.table("channels").put({ id: "ch-9", kind: "group", display_name: "Группа", last_pts: 7 });

        await applyChannelUpdate({ id: "ch-9", kind: "group", display_name: "Новое имя" });

        const row = await fakeDb.table("channels").get("ch-9");
        expect(row?.["display_name"]).toBe("Новое имя");
        expect(row?.["last_pts"]).toBe(7);

    });

    test("обновление канала не создаёт запись заново", async () => {

        await applyChannelUpdate({ id: "ch-10", kind: "group", display_name: "Группа" });

        expect((await fakeDb.table("channels").toArray()).length).toBe(0);

    });

});
