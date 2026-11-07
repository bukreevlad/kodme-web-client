// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем requests
import { getMessagesHistoryRequest } from "../requests/get_messages_history.js";

// Импортируем functions
import { messageHistory } from "./load_more_messages.js";

// Импортируем config
import { MESSAGES_WINDOW_SIZE } from "../../../config/constants.js";

// Импортируем типы
import type { Messages } from "../index.js";
import type { MessageRecord, MessageStoreAddOptions, MessagesDirection } from "../types.js";

/** Константы для определения нулевых ID */
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const ZERO_UUID_V7 = "00000000-0000-7000-0000-000000000000";

/**
 * ***************************************************************************
 * firstLoadMessages - первая загрузка сообщений при открытии канала.
 *
 * Порядок: контекст из IndexedDB вокруг последнего прочитанного → при пустом
 * кэше контекст у сервера → рендер пачки + pending → добивка экрана до
 * MESSAGES_WINDOW_SIZE рекурсивной подгрузкой в нужную сторону.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export async function firstLoadMessages(form: Messages): Promise<void> {

    // Если формы нет
    if (!form) return;

    // Если канала нет
    if (!form.channel) return;

    // Точка прокрутки: последнее прочитанное сообщение; isNeverRead —
    // канал ещё ни разу не читался (курсор не нужен, грузим начало)
    const lastViewedId = form.channel.last_viewed_message_id;
    const isNeverRead = !lastViewedId || lastViewedId === ZERO_UUID || lastViewedId === ZERO_UUID_V7;

    // Список сообщений обязателен — без него нечего готовить
    const list = form.list;
    if (!list) return;

    try {

        Logger.debug(`[app][history]: === Открытие канала "${form.channel.display_name}" ===`);
        Logger.debug(`[app][history]: last_viewed_message_id: ${lastViewedId}, isNeverRead: ${isNeverRead}`);

        // Подготовка UI
        if (form.listScrollManager) form.listScrollManager.enabled = false;
        list.style.opacity = "0";
        form.store.removeAll();
        list.innerHTML = "";

        // Сбрасываем состояние окна: маркер непрочитанных и направление вставки
        form.unreadMarkerBeforeId = null;
        form.unreadMarkerObserver?.disconnect();
        form.unreadMarkerObserver = null;
        form._lastInsertDirection = null;

        // Пытаемся взять контекст из локальной БД (пустой якорь не используется:
        // при отсутствии lastViewedId всегда isNeverRead = true)
        let messages = await _fetchInitialContext(form.channelId, lastViewedId ?? "", isNeverRead);
        Logger.debug(`[app][history]: Загружено из IndexedDB: ${messages.length}`);

        // Если в локальной базе пусто — идем на сервер
        if (messages.length === 0) {
            Logger.debug("[app][history]: IndexedDB пуста, запрашиваем контекст у сервера...");

            const response = await getMessagesHistoryRequest({
                channel_id: form.channelId,
                offset: 40,
                after_last_viewed_message: !isNeverRead // Если не читали — грузим начало
            });

            if (response.status && response.data) {
                messages = response.data;
                Logger.debug(`[app][history]: Сервер вернул ${messages.length} сообщений`);

                // Если пользователь не подписан, то он не получает обновления от сервера
                // И это вызовет проблемы, что сообщения не обновляются
                // Сохраняем только для участника (база может быть ещё не
                // открыта — тогда и сохранять некуда)
                if (form?.channel?.is_subscribed) {

                    const db = IndexedDB.db;

                    if (messages.length > 0) {

                        // Сортируем по ID перед сохранением и рендером
                        messages.sort((a, b) => a.id.localeCompare(b.id));
                        if (db) await db.table<MessageRecord, string>("messages").bulkPut(messages);

                    } else if (form.channel.last_message) {

                        // Если сервер пуст, но у канала есть last_message — подхватываем его
                        Logger.debug("[app][history]: Сообщений нет, используем last_message канала");
                        // invariant: сервер отдаёт last_message в метаданных канала
                        const lastMessage = form.channel.last_message as MessageRecord;
                        messages = [lastMessage];
                        if (db) await db.table<MessageRecord, string>("messages").put(lastMessage);

                    }

                }

            }
        }

        // Рендерим основные сообщения
        if (messages.length > 0) {
            _renderMessages(form, messages, isNeverRead);
        }

        // Добавляем Pending (неотправленные). База может быть ещё не открыта —
        // тогда и очередь пуста
        const db = IndexedDB.db;
        const pending = db
            ? await db.table<MessageRecord, string>("pending_messages")
                .where('channel_id')
                .equals(form.channelId)
                .sortBy('id')
            : [];

        if (pending.length > 0) {
            _renderMessages(form, pending, isNeverRead, true);
        }

        // Заполняем экран, если сообщений мало
        // Если канал новый, догружаем "вперед", если старый — "назад"
        await _ensureViewportIsFull(form, isNeverRead ? "next" : "prev");

    } catch (error) {
        Logger.error(error);
    } finally {
        // Передаем зафиксированное состояние isNeverRead
        _finalizeUI(form, isNeverRead);
    }

}

/**
 * ***************************************************************************
 * Окончательная настройка скролла и отображение списка
 * @param form - Экземпляр формы.
 * @param isNeverRead - Канал ни разу не читался.
 * ***************************************************************************
 */
function _finalizeUI(form: Messages, isNeverRead: boolean): void {

    // Небольшой таймаут, чтобы OverlayScrollbars успел обсчитать размеры
    setTimeout(() => {

        // Список обязателен к моменту финализации — без него нечего показывать
        const list = form.list;
        if (!list) return;

        if (!form.osListScrollInstance) {
            list.style.opacity = "1";
            return;
        }

        form.osListScrollInstance.update(true);
        const { viewport } = form.osListScrollInstance.elements();
        const unreadMarker = list.querySelector("[data-unread-messages]");

        Logger.debug(`[app][history]: Финализация UI. isNeverRead: ${isNeverRead}, marker: ${!!unreadMarker}`);

        // Отключаем плавность для мгновенного позиционирования
        viewport.style.scrollBehavior = "auto";

        if (unreadMarker) {
            // Скроллим так, чтобы маркер оказался чуть ниже верхней границы viewport
            const viewportRect = viewport.getBoundingClientRect();
            viewport.scrollTo({
                top: viewport.scrollTop + (unreadMarker.getBoundingClientRect().top - viewportRect.top) - 120,
                behavior: "instant"
            });
        } else if (isNeverRead) {
            // Если диалог новый — принудительно в начало (вверх)
            Logger.debug("[app][history]: Скролл ПРИНУДИТЕЛЬНО В НАЧАЛО (0)");
            viewport.scrollTo({
                top: 0,
                behavior: "instant"
            });
        } else {
            // В самый низ (если всё прочитано)
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: "instant"
            });
        }

        list.style.opacity = "1";
        if (form.listScrollManager) form.listScrollManager.enabled = true;
        Logger.debug(`[app][history]: Канал полностью отрисован. scrollTop: ${viewport.scrollTop}`);
    }, 50);

}

/**
 * ***************************************************************************
 * Рекурсивная проверка заполнения экрана
 * @param form - Экземпляр формы.
 * @param direction - Направление добивки ["prev" | "next"].
 * @returns void
 * ***************************************************************************
 */
async function _ensureViewportIsFull(form: Messages, direction: MessagesDirection = "prev"): Promise<void> {
    if (!form.osListScrollInstance || !form?.store?.minId) return;

    // Канал обязателен для границ окна — без него нечего догружать
    const channel = form.channel;
    if (!channel) return;

    // Защита от бесконечного цикла: окно достигло максимума — догружать больше нечего
    if (form.store.size >= MESSAGES_WINDOW_SIZE) return;

    form.osListScrollInstance.update(true);
    const { viewport } = form.osListScrollInstance.elements();

    const isNotFull = viewport.scrollHeight <= viewport.clientHeight;

    // Проверяем границы истории
    const isNotStart = form?.store?.minId !== channel.first_message_id;
    const isNotEnd = form?.store?.maxId !== channel.last_message_id;

    const shouldLoad = isNotFull && (direction === "prev" ? isNotStart : isNotEnd);

    if (shouldLoad) {
        Logger.debug(`[app][history]: Экран не заполнен, догружаем (${direction})...`);
        const loadedCount = await messageHistory(form, { direction });

        if (!loadedCount || loadedCount === 0) return;

        await new Promise(res => setTimeout(res, 50));
        return _ensureViewportIsFull(form, direction);
    }
}

/**
 * ***************************************************************************
 * Получение контекста из IndexedDB
 * @param channelId - Id канала.
 * @param anchorId - Якорь (последнее прочитанное сообщение).
 * @param isNeverRead - Канал ни разу не читался.
 * @returns Сообщения вокруг якоря.
 * ***************************************************************************
 */
async function _fetchInitialContext(channelId: string, anchorId: string, isNeverRead: boolean): Promise<MessageRecord[]> {

    // Без открытой базы локального контекста нет — вызывающий уйдёт на сервер
    const db = IndexedDB.db;
    if (!db) return [];

    if (isNeverRead) {
        // Если канал новый — берем первые 35 сообщений от начала времен
        return await db.table<MessageRecord, string>("messages")
            .where("[channel_id+id]")
            .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
            .limit(35)
            .toArray();
    }

    const prev = await db.table<MessageRecord, string>("messages")
        .where("[channel_id+id]")
        .between([channelId, Dexie.minKey], [channelId, anchorId], true, true)
        .reverse()
        .limit(30)
        .toArray();

    const next = await db.table<MessageRecord, string>("messages")
        .where("[channel_id+id]")
        .between([channelId, anchorId], [channelId, Dexie.maxKey], false, true)
        .limit(10)
        .toArray();

    return [...prev.reverse(), ...next];
}

/**
 * ***************************************************************************
 * Рендеринг пачки сообщений
 * Разделители дат и маркер непрочитанных здесь НЕ рисуются: их размещает
 * MessageList при синхронизации окна (после окончания пачки добавлений).
 * @param form - Экземпляр формы.
 * @param messages - Сообщения пачки.
 * @param isNeverRead - Канал ни разу не читался.
 * @param isPending - Пачка неотправленных (pending) сообщений.
 * ***************************************************************************
 */
function _renderMessages(form: Messages, messages: MessageRecord[], isNeverRead: boolean, isPending = false): void {

    // Канал обязателен для маркера непрочитанных — без него не рисуем пачку
    const channel = form.channel;
    if (!channel) return;
    const lastViewedId = channel.last_viewed_message_id;

    messages.forEach((message) => {
        // Фиксируем id сообщения, перед которым будет стоять линия непрочитанных.
        // НЕ фиксируем, если канал ни разу не читался или это pending-сообщение
        // (null-проверка якоря закрывает тип: в этой ветке lastViewedId
        // обязателен — isNeverRead гарантирует его наличие)
        if (!isPending && !isNeverRead && !form.unreadMarkerBeforeId && lastViewedId != null && message.id > lastViewedId) {
            form.unreadMarkerBeforeId = message.id;
        }

        // Направление вставки и границы окна пробрасываются подписчикам item::added
        const addOptions: MessageStoreAddOptions = {
            direction: "next",
            ignoreBounds: isPending
        };
        form.store.add(message, addOptions);
    });
}
