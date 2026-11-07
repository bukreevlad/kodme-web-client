// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { secretMessagesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем functions
import { decryptSecretMessage, withResolvedReply } from "./decrypt_message.js";
import { hydrateFileBlobs } from "./file_progress.js";

// Импортируем типы
import type { SecretMessageRecord } from "../../../types/secret_chats.js";
import type { SecretChatMessageRecord, SecretChatStoreAddOptions, SecretChatDirection } from "../types.js";
import type { SecretChat } from "../index.js";

/**
 * Опции подгрузки истории сообщений.
 */
export interface MessageHistoryOptions {

    /** Направление загрузки ["prev" | "next"]. */
    direction: SecretChatDirection;

}

/**
 * Размер страницы подгрузки истории из IndexedDB.
 */
const PAGE_SIZE = 35;

/**
 * ***************************************************************************
 * messageHistory - подгрузка страницы истории из локального хранилища.
 *
 * История секретного чата живёт только локально (IndexedDB): «серверной»
 * ветки нет в принципе. Курсор — `created_at` пограничного сообщения окна
 * (индекс `[chat_id+created_at]`). Результат — число добавленных сообщений
 * (0 — если грузить нечего).
 * @param form - Экземпляр формы.
 * @param options - Опции (направление загрузки).
 * @returns Число загруженных сообщений либо ничего (защита от параллельных загрузок).
 * ***************************************************************************
 */
export async function messageHistory(form: SecretChat, options: MessageHistoryOptions): Promise<number | void> {

    if (form.isMessagesLoading) return;
    form.isMessagesLoading = true;

    try {

        // Курсор — created_at пограничного сообщения окна (epoch ms)
        let cursorAt: number | undefined;
        for (const record of form.store.getAll()) {
            const createdAt = Date.parse(record.created_at ?? "");
            if (!Number.isFinite(createdAt)) continue;
            if (options.direction === "prev" && (cursorAt == null || createdAt < cursorAt)) cursorAt = createdAt;
            if (options.direction === "next" && (cursorAt == null || createdAt > cursorAt)) cursorAt = createdAt;
        }

        // Пустое окно — догружать не по чему (первую пачку грузит firstLoad)
        if (cursorAt == null) {
            form.isMessagesLoading = false;
            return 0;
        }

        // Читаем страницу из локальной истории вокруг курсора
        const records = options.direction === "prev"
            ? await secretMessagesTable()
                .where("[chat_id+created_at]")
                .between([form.chatId, Dexie.minKey], [form.chatId, cursorAt], false, false)
                .reverse()
                .limit(PAGE_SIZE)
                .toArray()
            : await secretMessagesTable()
                .where("[chat_id+created_at]")
                .between([form.chatId, cursorAt], [form.chatId, Dexie.maxKey], false, false)
                .limit(PAGE_SIZE)
                .toArray();

        if (records.length === 0) {
            form.isMessagesLoading = false;
            return 0;
        }

        // Расшифровываем пачку и резолвим цитаты ответов
        const messages = await decryptBatch(form, records);

        // --- ОТРИСОВКА ---
        processAndAddMessages(form, messages, options.direction);

        // Фоново подставляем оригиналы файлов догруженных сообщений
        hydrateFileBlobs(form);

        // Возвращаем количество добавленных сообщений (для проверки заполнения экрана)
        return messages.length;

    } catch (error) {
        Logger.error("[app][secret-chat][history]: Ошибка загрузки истории:", error);
        return 0;
    } finally {
        form.isMessagesLoading = false;
    }

}

/**
 * ***************************************************************************
 * Расшифровка пачки записей с разрешением цитат ответов.
 * @param form - Экземпляр формы.
 * @param records - Записи из IndexedDB.
 * @returns Расшифрованные записи для Store/DOM.
 * ***************************************************************************
 */
export async function decryptBatch(form: SecretChat, records: SecretMessageRecord[]): Promise<SecretChatMessageRecord[]> {

    const decrypted = await Promise.all(records.map(record => decryptSecretMessage(record)));
    return await Promise.all(decrypted.map(record => withResolvedReply(form, record)));

}

/**
 * ***************************************************************************
 * Обработка сообщений и вставка в Store/DOM.
 * Разделители дат НЕ вставляются здесь: их пересобирает MessageList
 * после окончания пачки (reconcileDivider), чтобы не плодить "сирот".
 * @param form - Экземпляр формы.
 * @param messages - Сообщения пачки.
 * @param direction - Направление вставки ["prev" | "next"].
 * @returns void
 * ***************************************************************************
 */
function processAndAddMessages(form: SecretChat, messages: SecretChatMessageRecord[], direction: SecretChatDirection): void {

    if (direction === "prev") {

        const options: SecretChatStoreAddOptions = { direction: "prev" };
        for (let i = messages.length - 1; i >= 0; i--) {
            const current = messages[i];
            if (!current) continue;
            if (form.store.get(current.id)) continue; // Защита от дублей (live-события)
            form.store.add(current, options);
        }

    } else {

        const options: SecretChatStoreAddOptions = { direction: "next" };
        messages.forEach((current) => {
            if (form.store.get(current.id)) return; // Защита от дублей
            form.store.add(current, options);
        });

    }
}
