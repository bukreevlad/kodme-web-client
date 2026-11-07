// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "./logs/logger.js";

/**
 * Задача очереди запросов к БД (синхронная либо асинхронная).
 */
type IndexedDbTask = () => void | Promise<void>;

// Модуль: indexedDB
export class IndexedDB {

    // Устанавливаем параметры
    static db: Dexie | null = null;
    static queue: IndexedDbTask[] = [];      // Массив задач
    static processing = false;  // Флаг, что очередь обрабатывается

    // ***************************************************************************
    // Добавление задачи в очередь
    // ***************************************************************************
    static enqueue(task: IndexedDbTask): void {
        this.queue.push(task);
        this.runQueue(); // Стартуем обработку, если не идет
    }

    // ***************************************************************************
    // Работа с очередью запросов к бд
    // ***************************************************************************
    static async runQueue(): Promise<void> {

        // Если задача выполняется
        if (this.processing) return;

        // Устанавливаем параметр
        this.processing = true;

        // Проходим по задачам и выполняем
        while (this.queue.length > 0) {

            const task = this.queue.shift();
            try {
                if (task) await task();
            } catch (err) {
                Logger.error("[app][IndexedDB]: Ошибка при выполнении задачи:", err);
            }

        }

        // Устанавливаем параметр
        this.processing = false;

    }

    // ***************************************************************************
    // Инициализация и открытие БД
    // ***************************************************************************
    static async initial(sessionId: string | null): Promise<void> {

        // Проверяем открыта ли БД
        if (this.db) {
            Logger.warn("[app][IndexedDB]: База данных уже инициализирована.");
            return;
        }

        // Создаем экземпляр Dexie
        const db = new Dexie(`codeme::${sessionId}`);
        this.db = db;

        // Определяем схему БД
        db.version(5).stores({
            channels: `&id, last_message_id, display_user_id, type, topic_for_group_id, [display_user_id+type]`,
            messages: `&id, channel_id, [channel_id+id]`,
            pending_messages: `&id, channel_id, [channel_id+id]`,

            pending_updates: `&id, channel_id, data, status, timestamp`,
        });

        // Секретные чаты: хранятся только локально, данные — vault-шифротекст
        db.version(6).stores({
            secret_chats: `&id, peer_user_id, peer_device_id, status, created_at, last_message_at`,
            secret_messages: `&id, chat_id, [chat_id+created_at], status`,
            secret_files: `&id, message_id, chat_id`,
        });

        // Открываем БД и обрабатываем Promise
        try {

            await db.open();
            Logger.debug("[app][IndexedDB]: База данных успешно открыта или создана.");

        } catch (error) {

            Logger.error("[app][IndexedDB]: Ошибка при открытии/создании базы данных:", error);
            this.db = null;
            throw error;

        }

    }

    // ***************************************************************************
    // Открытие БД для работы с ней
    // ***************************************************************************
    static close(): void {

        if (this.db) {
            this.db.close();
            this.db = null;
            Logger.debug("[app][IndexedDB]: База данных закрыта.");
        } else {
            Logger.warn("[app][IndexedDB]: База данных не инициализирована.");
        }

    }

    // ***************************************************************************
    // Удаление БД
    // ***************************************************************************
    static delete(): void {

        if (this.db) {
            this.db.delete();
            this.db = null;
            console.log("[app][IndexedDB]: База данных удалена.");
        } else {
            console.warn("[app][IndexedDB]: База данных не инициализирована.");
        }

    }

}
