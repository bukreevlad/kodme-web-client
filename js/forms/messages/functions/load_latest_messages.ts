// Импортируем сторонние пакеты
import Dexie from "dexie";
import { v7 as Uuidv7 } from "uuid";

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
import type { MessageRecord, MessageStoreAddOptions } from "../types.js";
import type { Messages } from "../index.js";

/** Нулевые UUID для определения «никогда не читавшегося» канала */
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const ZERO_UUID_V7 = "00000000-0000-7000-0000-000000000000";

/** Размер «хвоста» канала (последних сообщений) для прыжка вниз */
const TAIL_SIZE = 40;

/**
 * Потолок добивки экрана вверх: не даём окну разрастись до MESSAGES_WINDOW_SIZE,
 * иначе trimWindow начнёт срезать самые свежие сообщения с нижнего края
 * (направление вставки "prev" режет максимальный id).
 */
const FILL_LIMIT = Math.min(MESSAGES_WINDOW_SIZE, 120);

/**
 * ***************************************************************************
 * ПРЫЖОК К САМЫМ ПОСЛЕДНИМ СООБЩЕНИЯМ КАНАЛА.
 * Используется кнопкой «прокрутить вниз», когда последнее сообщение канала
 * отсутствует в окне (Store): пересобираем окно вокруг «хвоста» канала
 * (последние TAIL_SIZE сообщений включительно с последним) и позиционируем
 * скролл в самый низ. Данные берём сначала из IndexedDB, при «дыре» — с сервера.
 * @param form - Форма сообщений.
 * @returns Количество загруженных сообщений (0 — если делать нечего).
 * ***************************************************************************
 */
export async function loadLatestMessages(form: Messages): Promise<number> {

    // Если формы или канала нет — делать нечего
    if (!form?.channel || !form.channelId) return 0;

    // Если у канала нет последнего сообщения (пустой диалог) — прыгать некуда
    if (!form.channel.last_message_id) return 0;

    // Если последнее сообщение уже в окне — нужен только скролл, не пересборка
    if (form.store?.get(form.channel.last_message_id)) return 0;

    // Защита от параллельной загрузки (скролл-события и т.п.)
    if (form.isMessagesLoading) return 0;
    form.isMessagesLoading = true;

    try {

        // Получаем «хвост» канала (IndexedDB → сервер)
        const messages = await fetchTail(form);

        // Сервер/БД пусты — ничего не показываем
        if (messages.length === 0) return 0;

        // Пересобираем окно вокруг хвоста (Store + DOM)
        await rebuildWindow(form, messages);

        // Возвращаем общий флаг: добивка экрана использует MessageHistory,
        // который сам управляет этим флагом внутри
        form.isMessagesLoading = false;

        // Добиваем экран вверх старыми сообщениями, если хвост не заполнил viewport
        await fillViewportUp(form);

        // Позиционируемся в самый низ (список пока скрыт — без «пролёта»)
        finalizeScroll(form);

        // Возвращаем количество добавленных сообщений
        return messages.length;

    } catch (error) {
        Logger.error(error);
        return 0;
    } finally {
        form.isMessagesLoading = false;

        // Страховка: при любой ошибке возвращаем список и скролл на экран,
        // чтобы форма не осталась скрытой (opacity: 0) и без ScrollManager
        if (form?.list) {
            form.list.style.opacity = "1";
            if (form?.listScrollManager) form.listScrollManager.enabled = true;
        }
    }
}

/**
 * ***************************************************************************
 * Получение «хвоста» канала: последние TAIL_SIZE сообщений включительно с последним.
 * Сначала пробуем IndexedDB; если локальные данные не доезжают до last_message_id —
 * делаем ОДИН запрос к серверу с «будущим» UUIDv7 курсором: для direction="prev"
 * сервер возвращает сообщения с id МЕНЬШЕ курсора в порядке DESC, поэтому любой
 * id из будущего гарантированно даёт самые свежие сообщения канала.
 * @param form - Форма сообщений.
 * @returns Сообщения в порядке возрастания id.
 * ***************************************************************************
 */
async function fetchTail(form: Messages): Promise<MessageRecord[]> {

    // Локальная БД может быть не инициализирована — тогда хвост берём
    // только у сервера
    const db = IndexedDB.db;

    // Пытаемся взять хвост из локальной БД (последние записи канала)
    let messages: MessageRecord[] = db
        ? await db.table<MessageRecord, string>("messages")
            .where("[channel_id+id]")
            .between([form.channelId, Dexie.minKey], [form.channelId, Dexie.maxKey])
            .reverse()
            .limit(TAIL_SIZE)
            .toArray()
        : [];
    messages.reverse();

    // Локальные данные доходят до последнего сообщения канала — используем их
    // (канал может быть ещё не загружен: без id последнего сообщения
    // сравнение не имеет смысла, идём к серверу, как при неполном хвосте)
    const lastMessageId = form.channel?.last_message_id;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessageId != null && lastMessage.id >= lastMessageId) {
        return messages;
    }

    Logger.debug("[app][messages][scroll-down]: Хвост не найден в IndexedDB, запрашиваем у сервера...");

    // «Будущий» UUIDv7: заведомо больше любого реального id сообщения канала
    const futureCursor = Uuidv7({ msecs: Date.now() + 86_400_000 });

    const response = await getMessagesHistoryRequest({
        channel_id: form.channelId,
        direction: "prev",
        cursor_id: futureCursor,
        offset: TAIL_SIZE
    });

    if (!response?.status || !Array.isArray(response?.data) || response.data.length === 0) {
        return [];
    }

    // Сервер возвращает хвост в порядке DESC — приводим к возрастающему
    const tail = [...response.data].sort((a, b) => a.id.localeCompare(b.id));

    // Сохраняем в IndexedDB, чтобы при следующем прыжке не дёргать сервер
    if (db && form?.channel?.is_subscribed) {
        await db.table<MessageRecord, string>("messages").bulkPut(tail).catch((e: unknown) => Logger.error(e));
    }

    return tail;
}

/**
 * ***************************************************************************
 * Пересборка окна сообщений вокруг «хвоста» канала.
 * Очищаем Store и DOM, добавляем хвост (append) и исходящие pending-сообщения,
 * которые должны оставаться видимыми в самом низу. Маркер непрочитанных
 * фиксируем перед первым сообщением, которое новее last_viewed_message_id
 * (при прыжке вниз «стена» непрочитанных остаётся сверху окна).
 * @param form - Форма сообщений.
 * @param messages - Хвост канала (возрастающий порядок id).
 * @returns Promise<void>
 * ***************************************************************************
 */
async function rebuildWindow(form: Messages, messages: MessageRecord[]): Promise<void> {

    // Список задаётся в _onBeforeOpen — без него пересобирать нечего
    const list = form.list;
    if (!list) return;

    // Отключаем скролл и прячем список, чтобы пересборка не «мельтешила»
    if (form.listScrollManager) form.listScrollManager.enabled = false;
    list.style.opacity = "0";

    // Сбрасываем окно: Store, DOM, маркер непрочитанных, направление вставки
    form.store.removeAll();
    list.innerHTML = "";
    form.unreadMarkerBeforeId = null;
    form.unreadMarkerObserver?.disconnect();
    form.unreadMarkerObserver = null;
    form._lastInsertDirection = null;

    // Страховка порядка: хвост должен идти строго по возрастанию id
    messages.sort((a, b) => a.id.localeCompare(b.id));

    // Фиксируем маркер непрочитанных перед первым сообщением новее last_viewed
    // (канал может быть ещё не загружен — тогда маркер не фиксируем)
    const lastViewedId = form.channel?.last_viewed_message_id;
    const isNeverRead = !lastViewedId || lastViewedId === ZERO_UUID || lastViewedId === ZERO_UUID_V7;
    if (!isNeverRead) {
        const firstUnread = messages.find((message) => message.id > lastViewedId);
        if (firstUnread) form.unreadMarkerBeforeId = firstUnread.id;
    }

    // Добавляем хвост в Store (append) — обрезку окна сделает синхронизация
    const appendOptions: MessageStoreAddOptions = { direction: "next" };
    messages.forEach((message) => {
        if (form.store.get(message.id)) return; // Страховка от дублей (live-события)
        form.store.add(message, appendOptions);
    });

    // Возвращаем в окно исходящие (pending) сообщения — они живут в самом низу
    await appendPending(form);
}

/**
 * ***************************************************************************
 * Возврат в окно исходящих (pending) сообщений после пересборки.
 * Поднимаем их из IndexedDB и добавляем в конец списка с ignoreBounds: границы
 * окна (minId/maxId) считаем только по подтверждённым сообщениям сервера.
 * @param form - Форма сообщений.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function appendPending(form: Messages): Promise<void> {

    // Без локальной БД исходящие недоступны — выходим
    const db = IndexedDB.db;
    if (!db) return;

    // Достаём исходящие сообщения этого канала из локальной БД
    const pending = await db.table<MessageRecord, string>("pending_messages")
        .where("channel_id")
        .equals(form.channelId)
        .sortBy("id");

    const options: MessageStoreAddOptions = { direction: "next", ignoreBounds: true };
    pending.forEach((message: MessageRecord) => {
        if (form.store.get(message.id)) return;
        form.store.add(message, options);
    });
}

/**
 * ***************************************************************************
 * Добивка экрана вверх: если «хвост» не заполнил высоту viewport, догружаем
 * старые сообщения (direction="prev") через общий механизм MessageHistory —
 * он сам проверяет границы канала и выбирает IndexedDB/сервер.
 * Рекурсия с защитами от бесконечного цикла (потолок FILL_LIMIT и границы).
 * @param form - Форма сообщений.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function fillViewportUp(form: Messages): Promise<void> {

    // Списка или окна нет — нечего добивать
    if (!form.osListScrollInstance || !form?.store?.minId) return;

    // Не даём окну разрастись: иначе trimWindow срежет самые свежие с нижнего края
    if (form.store.size >= FILL_LIMIT) return;

    form.osListScrollInstance.update(true);
    const { viewport } = form.osListScrollInstance.elements();

    // Экран уже заполнен — выходим
    const isNotFull = viewport.scrollHeight <= viewport.clientHeight;
    if (!isNotFull) return;

    // Упёрлись в самое первое сообщение канала — дальше истории нет
    // (канал может быть ещё не загружен — тогда граница неизвестна и
    // добивка продолжается до срабатывания других защит)
    const isNotStart = form?.store?.minId !== form.channel?.first_message_id;
    if (!isNotStart) return;

    Logger.debug("[app][messages][scroll-down]: Экран не заполнен, добиваем вверх...");
    const loadedCount = await messageHistory(form, { direction: "prev" });
    if (!loadedCount) return;

    // Даём браузеру пересчитать высоты и повторяем проверку заполнения
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
    return fillViewportUp(form);
}

/**
 * ***************************************************************************
 * Позиционирование скролла в самый низ после пересборки окна.
 * Прокрутка выполняется мгновенно, пока список скрыт (opacity: 0), затем список
 * показывается — пользователь видит сразу хвост канала без «пролёта» вниз.
 * @param form - Форма сообщений.
 * @returns void
 * ***************************************************************************
 */
function finalizeScroll(form: Messages): void {

    // Список задаётся в _onBeforeOpen — без него нечего показывать
    const list = form.list;
    if (!list) return;

    // Если скролл-инстанса нет (форма без OverlayScrollbars) — просто показываем
    if (!form.osListScrollInstance) {
        list.style.opacity = "1";
        if (form.listScrollManager) form.listScrollManager.enabled = true;
        return;
    }

    // Обновляем размеры и уходим в самый низ мгновенно (список ещё скрыт)
    form.osListScrollInstance.update(true);
    const { viewport } = form.osListScrollInstance.elements();

    viewport.style.scrollBehavior = "auto";
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
    viewport.style.scrollBehavior = "";

    // Возвращаем список на экран и включаем скролл
    list.style.opacity = "1";
    if (form.listScrollManager) form.listScrollManager.enabled = true;
}
