// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { secretMessagesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем functions
import { messageHistory, decryptBatch } from "./load_more_messages.js";
import { hydrateFileBlobs } from "./file_progress.js";

// Импортируем config
import { MESSAGES_WINDOW_SIZE } from "../../../config/constants.js";

// Импортируем типы
import type { SecretChatMessageRecord, SecretChatStoreAddOptions } from "../types.js";
import type { SecretChat } from "../index.js";

/** Число последних сообщений при первой загрузке. */
const TAIL_SIZE = 40;

/**
 * ***************************************************************************
 * firstLoadMessages - первая загрузка сообщений при открытии секретного чата.
 *
 * История всегда локальная (IndexedDB): берём последние TAIL_SIZE сообщений,
 * рендерим пачкой и добиваем экран вверх до MESSAGES_WINDOW_SIZE, если
 * сообщений мало. Маркер непрочитанных фиксируется перед первым входящим
 * сообщением без статуса "read".
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export async function firstLoadMessages(form: SecretChat): Promise<void> {

    // Если формы нет
    if (!form) return;

    // Если чата нет
    if (!form.chat) return;

    // Список сообщений обязателен — без него нечего готовить
    const list = form.list;
    if (!list) return;

    try {

        Logger.debug(`[app][secret-chat]: === Открытие секретного чата "${form.chatId}" ===`);

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

        // Последние сообщения чата из локальной истории
        const records = await secretMessagesTable()
            .where("[chat_id+created_at]")
            .between([form.chatId, Dexie.minKey], [form.chatId, Dexie.maxKey])
            .reverse()
            .limit(TAIL_SIZE)
            .toArray();
        records.reverse();

        // Расшифровываем пачку и резолвим цитаты ответов
        const messages = await decryptBatch(form, records);
        Logger.debug(`[app][secret-chat]: Загружено из IndexedDB: ${messages.length}`);

        // Рендерим основные сообщения
        if (messages.length > 0) {
            _renderMessages(form, messages);
        }

        // Заполняем экран, если сообщений мало (догружаем «назад»)
        await _ensureViewportIsFull(form);

        // Фоново подставляем оригиналы файлов (рендер строки строится по
        // миниатюрам, оригинал нужен для просмотра/воспроизведения)
        hydrateFileBlobs(form);

    } catch (error) {
        Logger.error(error);
    } finally {
        _finalizeUI(form);
    }

}

/**
 * ***************************************************************************
 * Окончательная настройка скролла и отображение списка: маркер непрочитанных
 * читается чуть ниже верхней границы viewport, иначе — в самый низ.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function _finalizeUI(form: SecretChat): void {

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

        // Отключаем плавность для мгновенного позиционирования
        viewport.style.scrollBehavior = "auto";

        if (unreadMarker) {
            // Скроллим так, чтобы маркер оказался чуть ниже верхней границы viewport
            const viewportRect = viewport.getBoundingClientRect();
            viewport.scrollTo({
                top: viewport.scrollTop + (unreadMarker.getBoundingClientRect().top - viewportRect.top) - 120,
                behavior: "instant"
            });
        } else {
            // В самый низ (всё прочитано)
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: "instant"
            });
        }

        list.style.opacity = "1";
        if (form.listScrollManager) form.listScrollManager.enabled = true;
        Logger.debug(`[app][secret-chat]: Чат полностью отрисован. scrollTop: ${viewport.scrollTop}`);
    }, 50);

}

/**
 * ***************************************************************************
 * Рекурсивная проверка заполнения экрана (догрузка «назад» из локальной истории).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
async function _ensureViewportIsFull(form: SecretChat): Promise<void> {

    if (!form.osListScrollInstance || !form?.store?.minId) return;

    // Защита от бесконечного цикла: окно достигло максимума — догружать больше нечего
    if (form.store.size >= MESSAGES_WINDOW_SIZE) return;

    form.osListScrollInstance.update(true);
    const { viewport } = form.osListScrollInstance.elements();

    // Экран уже заполнен — выходим
    if (viewport.scrollHeight > viewport.clientHeight) return;

    Logger.debug("[app][secret-chat]: Экран не заполнен, догружаем (prev)...");
    const loadedCount = await messageHistory(form, { direction: "prev" });

    if (!loadedCount || loadedCount === 0) return;

    await new Promise<void>(res => setTimeout(res, 50));
    return _ensureViewportIsFull(form);
}

/**
 * ***************************************************************************
 * Рендеринг пачки сообщений.
 * Разделители дат и маркер непрочитанных здесь НЕ рисуются: их размещает
 * MessageList при синхронизации окна (после окончания пачки добавлений).
 * @param form - Экземпляр формы.
 * @param messages - Сообщения пачки.
 * @returns void
 * ***************************************************************************
 */
function _renderMessages(form: SecretChat, messages: SecretChatMessageRecord[]): void {

    messages.forEach((message) => {

        // Фиксируем id сообщения, перед которым будет стоять линия непрочитанных:
        // первое входящее, которое ещё не прочитано
        if (!form.unreadMarkerBeforeId && message.sender === "peer" && message.status !== "read") {
            form.unreadMarkerBeforeId = message.id;
        }

        // Направление вставки пробрасывается подписчикам item::added
        const addOptions: SecretChatStoreAddOptions = {
            direction: "next"
        };
        form.store.add(message, addOptions);
    });
}
