// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config
import { COMMENTS_PAGE_SIZE, COMMENTS_WINDOW_SIZE } from "../../../config/constants.js";

// Импортируем requests
import { getCommentsHistoryRequest } from "../requests/get_comments_history.js";

// Импортируем functions
import { commentsHistory } from "./load_more_comments.js";
import { CommentList } from "./comment_list.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { CommentRecord, CommentsDirection, CommentStoreAddOptions } from "../types.js";

/**
 * ***************************************************************************
 * firstLoadComments - первая загрузка комментариев при открытии ветки.
 *
 * Порядок: сброс UI → последняя страница вокруг сохранённой позиции возврата
 * (`after_last_viewed_comment: true`) → границы ветки и якорь разделителя
 * «Новые комментарии» → добивка экрана до COMMENTS_WINDOW_SIZE рекурсивной
 * подгрузкой в нужную сторону → финализация (скролл к разделителю или вниз).
 *
 * Данные хранятся только в памяти формы — без IndexedDB (решение по
 * комментариям): при каждом открытии ветка запрашивается у сервера.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export async function firstLoadComments(form: Comments): Promise<void> {

    // Если формы нет или загрузка уже идёт
    if (!form || form.isCommentsLoading) return;

    // Ставим флаг: защищает от параллельных загрузок (двойной scroll и т.п.)
    form.isCommentsLoading = true;

    // Позиция возврата и флаг «не прочитано» фиксируются ДО загрузки:
    // finalizeUI использует их без гонки с обновлениями формы
    const lastViewedId = form.lastViewedCommentId;
    const isNeverRead = !lastViewedId;

    const list = form.list;
    if (!list) return;

    try {

        // Подготовка UI: список скрыт и пуст, менеджер скролла выключен —
        // позицию задаст финализация
        if (form.listScrollManager) form.listScrollManager.enabled = false;
        list.style.opacity = "0";
        form.store.removeAll();
        list.innerHTML = "";

        // Сбрасываем состояние окна: разделитель и направление вставки
        form.newDividerBeforeId = null;
        form.newDividerObserver?.disconnect();
        form.newDividerObserver = null;
        form._lastInsertDirection = null;

        // Запрашиваем последнюю страницу вокруг сохранённой позиции возврата
        // (без позиции сервер отдаёт хвост ветки)
        const response = await getCommentsHistoryRequest({
            entity_id: form.postId,
            entity_type: "message",
            after_last_viewed_comment: true,
            offset: COMMENTS_PAGE_SIZE
        });

        // Данные ответа обязательны — без них нечего рендерить
        const result = response.data;
        if (!result) throw new Error("Не смогли загрузить комментарии");

        // Границы ветки: по ним работает подгрузка вверх/вниз
        form.firstCommentId = result.first_comment_id;
        form.lastCommentId = result.last_comment_id;

        // Страницу сортируем по возрастанию id: UUIDv7 монотонны по времени,
        // localeCompare даёт стабильный порядок ленты (сервер для prev
        // возвращает по убыванию)
        const comments = [...(result.comments ?? [])].sort((a, b) => a.id.localeCompare(b.id));

        // Рендерим основную пачку
        if (comments.length > 0) _renderComments(form, comments, lastViewedId);

        // Заполняем экран, если комментариев мало: вверх от якоря прочтения,
        // вниз — если ветка не читалась (открываем хвост)
        await _ensureViewportIsFull(form, isNeverRead ? "next" : "prev");

    } catch (error) {
        Logger.error("[app][comments][first-load]", error);
    } finally {

        // Передаём зафиксированное состояние isNeverRead
        _finalizeUI(form, isNeverRead);

        // Снимаем флаг подзагрузки
        form.isCommentsLoading = false;

    }

}

/**
 * ***************************************************************************
 * Рендеринг пачки комментариев в Store.
 * Разделители дат и «Новые комментарии» здесь НЕ рисуются: их размещает
 * CommentList при синхронизации окна (после окончания пачки добавлений).
 * @param form - Экземпляр формы.
 * @param comments - Комментарии пачки (asc по id).
 * @param lastViewedId - Сохранённая позиция возврата (null — читать не начинали).
 * @returns void
 * ***************************************************************************
 */
function _renderComments(form: Comments, comments: CommentRecord[], lastViewedId: string | null): void {

    // Направление вставки пробрасывается подписчикам item::added (typed-переменная:
    // в объявлении опций поле direction не заведено — excess check сработал бы)
    const addOptions: CommentStoreAddOptions = { direction: "next" };

    comments.forEach((comment) => {

        // Фиксируем id комментария, перед которым будет стоять разделитель
        // «Новые комментарии»: первый комментарий новее позиции возврата
        if (!form.newDividerBeforeId && lastViewedId && comment.id > lastViewedId) {
            form.newDividerBeforeId = comment.id;
        }

        form.store.add(comment, addOptions);

    });

}

/**
 * ***************************************************************************
 * Рекурсивная проверка заполнения экрана.
 * @param form - Экземпляр формы.
 * @param direction - Направление добивки ["prev" | "next"].
 * @returns void
 * ***************************************************************************
 */
async function _ensureViewportIsFull(form: Comments, direction: CommentsDirection = "prev"): Promise<void> {

    // Без менеджера скролла и Store размеры не обсчитать
    if (!form.osListScrollInstance || !form.store.minId) return;

    // Защита от бесконечного цикла: окно достигло максимума
    if (form.store.size >= COMMENTS_WINDOW_SIZE) return;

    form.osListScrollInstance.update(true);
    const { viewport } = form.osListScrollInstance.elements();

    const isNotFull = viewport.scrollHeight <= viewport.clientHeight;

    // Проверяем границы ветки: сверху добрались до самого старого,
    // снизу — до самого свежего комментария
    const isNotStart = form.firstCommentId != null && form.store.minId !== form.firstCommentId;
    const isNotEnd = form.lastCommentId != null && form.store.maxId !== form.lastCommentId;

    const shouldLoad = isNotFull && (direction === "prev" ? isNotStart : isNotEnd);

    if (shouldLoad) {

        Logger.debug(`[app][comments][first-load]: Экран не заполнен, догружаем (${direction})...`);
        const loadedCount = await commentsHistory(form, { direction });

        if (!loadedCount || loadedCount === 0) return;

        await new Promise(res => setTimeout(res, 50));
        return _ensureViewportIsFull(form, direction);

    }

}

/**
 * ***************************************************************************
 * Окончательная настройка скролла и отображение списка: позиция —
 * к разделителю «Новые комментарии» либо в самый низ ленты.
 * @param form - Экземпляр формы.
 * @param isNeverRead - Ветка ни разу не читалась.
 * @returns void
 * ***************************************************************************
 */
function _finalizeUI(form: Comments, isNeverRead: boolean): void {

    // Небольшой таймаут, чтобы OverlayScrollbars успел обсчитать размеры
    setTimeout(() => {

        // Список обязателен к моменту финализации — без него нечего показывать
        const list = form.list;
        if (!list) return;

        // Без скроллбара просто показываем список
        if (!form.osListScrollInstance) {
            list.style.opacity = "1";
            return;
        }

        form.osListScrollInstance.update(true);
        const { viewport } = form.osListScrollInstance.elements();
        const newDivider = list.querySelector("[data-new-comments]");

        // Отключаем плавность для мгновенного позиционирования
        viewport.style.scrollBehavior = "auto";

        if (newDivider) {

            // Скроллим так, чтобы разделитель оказался чуть ниже верхней границы viewport
            const viewportRect = viewport.getBoundingClientRect();
            viewport.scrollTo({
                top: viewport.scrollTop + (newDivider.getBoundingClientRect().top - viewportRect.top) - 120,
                behavior: "instant"
            });

        } else if (isNeverRead) {

            // Ветка не читалась — открываем хвост (свежие комментарии внизу)
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: "instant"
            });

        } else {

            // Всё прочитано — в самый низ
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: "instant"
            });

        }

        // Показываем список и включаем менеджер скролла
        list.style.opacity = "1";
        if (form.listScrollManager) form.listScrollManager.enabled = true;

        Logger.debug(`[app][comments][first-load]: Лента отрисована. scrollTop: ${viewport.scrollTop}`);

    }, 50);

}
