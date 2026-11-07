// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем requests
import { getMessagesHistoryRequest } from "../requests/get_messages_history.js";

// Импортируем типы
import type { MessageRecord, MessageStoreAddOptions, MessagesDirection } from "../types.js";
import type { Messages } from "../index.js";

/**
 * Опции подгрузки истории сообщений.
 */
export interface MessageHistoryOptions {

    /** Направление загрузки ["prev" | "next"]. */
    direction: MessagesDirection;

}

/**
 * ***************************************************************************
 * Подгрузка истории сообщений (Reliable Sync).
 *
 * Приоритет — локальная IndexedDB; сервер нужен только при «дыре» между
 * окном и метаданными канала. Результат — число добавленных сообщений
 * (0 — если грузить нечего).
 * @param form - Экземпляр формы.
 * @param options - Опции (направление загрузки).
 * @returns Число загруженных сообщений либо ничего (защита от параллельных загрузок).
 * ***************************************************************************
 */
export async function messageHistory(form: Messages, options: MessageHistoryOptions): Promise<number | void> {

    if (form.isMessagesLoading) return;
    form.isMessagesLoading = true;

    try {

        // invariant: id сообщений — UUIDv7 (строки), поэтому граница стора
        // пригодна как курсор запроса
        let cursorId: string | undefined;
        if (options.direction === "prev") cursorId = form?.store?.minId as string;
        if (options.direction === "next") cursorId = form?.store?.maxId as string;

        if (!cursorId) {
            form.isMessagesLoading = false;
            return 0;
        }

        // Канал обязателен: границы истории и печать конца живут в нём
        // (создаётся вместе с формой)
        const channel = form.channel;
        if (!channel) {
            form.isMessagesLoading = false;
            return 0;
        }

        // --- ТЕЛЕГРАМ ЛОГИКА ПРОВЕРКИ ГРАНИЦ ---

        // 1. Если скроллим ВВЕРХ и уже достигли самого первого сообщения канала
        if (options.direction === "prev" && channel.first_message_id === cursorId) {
            form.isMessagesLoading = false;
            return 0;
        }

        // 2. Если скроллим ВНИЗ и наш курсор — это последнее сообщение канала (уже в эфире)
        // Сравнение UUIDv7 корректно работает через >= или <=
        // (без last_message_id сравнивать не с чем — считаем, что конца ещё нет)
        if (options.direction === "next" && channel.last_message_id != null && cursorId >= channel.last_message_id) {
            form.isMessagesLoading = false;
            return 0;
        }

        let messages: MessageRecord[] = [];

        // --- 1. ПРИОРИТЕТ: ВСЕГДА СНАЧАЛА INDEXED DB ---
        // Без инициализированной базы пропускаем локальный шаг —
        // сразу сработает серверная ветка ниже
        const db = IndexedDB.db;
        if (db) {
            if (options.direction === "prev") {
                messages = await db.table<MessageRecord, string>("messages")
                    .where("[channel_id+id]")
                    .between([form.channelId, Dexie.minKey], [form.channelId, cursorId], false, false)
                    .reverse()
                    .limit(35)
                    .toArray();
                messages.reverse();
            } else {
                messages = await db.table<MessageRecord, string>("messages")
                    .where("[channel_id+id]")
                    .between([form.channelId, cursorId], [form.channelId, Dexie.maxKey], false, false)
                    .limit(35)
                    .toArray();
            }
        }

        // --- 2. СЕРВЕР: ТОЛЬКО ЕСЛИ ЕСТЬ "ДЫРА" ---
        // Если в локальной базе пусто, но по метаданным канала (last_message_id) мы знаем,
        // что сообщения ТАМ ДОЛЖНЫ БЫТЬ — только тогда идем на сервер.
        if (messages.length === 0) {

            // Если мы крутим вниз и локально пусто, проверяем: а есть ли смысл идти на сервер?
            if (options.direction === "next" && channel.last_message_id != null && cursorId >= channel.last_message_id) {
                form.isMessagesLoading = false;
                return 0;
            }

            Logger.debug(`[app][messages][history]: Gap detected, fetching server (${options.direction})...`);

            let response = await getMessagesHistoryRequest({
                channel_id: form.channelId,
                direction: options.direction,
                cursor_id: cursorId,
                offset: 35
            });

            if (response.status && response.data && response.data.length > 0) {
                messages = response.data;

                // Если пользователь не подписан, то он не получает обновления от сервера
                // И это вызовет проблемы, что сообщения не обновляются
                // Сохраняем только для участника
                if (db && channel.is_subscribed) {
                    await db.table<MessageRecord, string>("messages").bulkPut(messages).catch((e: unknown) => Logger.error(e));
                }

                if (options.direction === "prev") messages.reverse();
            } else {
                // ВАЖНО: Если сервер вернул 0 сообщений при скролле ВНИЗ,
                // значит наш мета-указатель last_message_id был неактуален.
                // Приравниваем его к текущему курсору, чтобы больше не "долбить" сервер.
                if (options.direction === "next") {
                    Logger.warn("[app][messages][history]: End of stream reached. Sealing channel.");
                    channel.last_message_id = cursorId;
                }
            }
        }

        // --- 3. ОТРИСОВКА ---
        if (messages.length > 0) {
            processAndAddMessages(form, messages, options.direction);
        }

        // Возвращаем количество добавленных сообщений (для проверки заполнения экрана)
        return messages.length;

    } catch (error) {
        Logger.error("Ошибка загрузки истории:", error);
        return 0;
    } finally {
        form.isMessagesLoading = false;
    }

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
function processAndAddMessages(form: Messages, messages: MessageRecord[], direction: MessagesDirection): void {

    if (direction === "prev") {

        const options: MessageStoreAddOptions = { direction: "prev" };
        for (let i = messages.length - 1; i >= 0; i--) {
            const current = messages[i];
            if (!current) continue;
            if (form.store.get(current.id)) continue; // Защита от дублей (WebSocket sync)
            form.store.add(current, options);
        }

    } else {

        const options: MessageStoreAddOptions = { direction: "next" };
        messages.forEach((current) => {
            if (form.store.get(current.id)) return; // Защита от дублей
            form.store.add(current, options);
        });

    }
}
