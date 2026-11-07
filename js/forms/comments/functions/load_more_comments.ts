// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config
import { COMMENTS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем requests
import { getCommentsHistoryRequest } from "../requests/get_comments_history.js";

// Импортируем типы
import type { CommentRecord, CommentsDirection, CommentStoreAddOptions } from "../types.js";
import type { Comments } from "../index.js";

/**
 * Опции подгрузки страницы комментариев.
 */
export interface CommentsHistoryOptions {

    /** Направление загрузки ["prev" | "next"]. */
    direction: CommentsDirection;

}

/**
 * ***************************************************************************
 * commentsHistory - подгрузка страницы комментариев (keyset-пагинация).
 *
 * В отличие от формы сообщений ленты комментариев — без IndexedDB: ветка
 * хранится только в памяти формы, каждая страница всегда идёт на сервер.
 * Курсор — крайний id Store (UUIDv7 монотонны), границы ветки —
 * `first_comment_id` / `last_comment_id` из ответа первой загрузки.
 * Результат — число добавленных комментариев (0 — грузить нечего).
 * @param form - Экземпляр формы.
 * @param options - Опции (направление загрузки).
 * @returns Число загруженных комментариев либо ничего (защита от параллельных загрузок).
 * ***************************************************************************
 */
export async function commentsHistory(form: Comments, options: CommentsHistoryOptions): Promise<number | void> {

    // Защита от параллельных загрузок
    if (!form || form.isCommentsLoading) return;
    form.isCommentsLoading = true;

    try {

        // invariant: id комментариев — UUIDv7 (строки), поэтому граница стора
        // пригодна как курсор запроса
        let cursorId: string | undefined;
        if (options.direction === "prev") cursorId = form.store.minId as string;
        if (options.direction === "next") cursorId = form.store.maxId as string;

        if (!cursorId) return 0;

        // --- ПРОВЕРКА ГРАНИЦ ВЕТКИ ---

        // Скроллим вверх и уже добрались до самого старого комментария
        if (options.direction === "prev" && form.firstCommentId && cursorId <= form.firstCommentId) {
            return 0;
        }

        // Скроллим вниз и курсор — самый свежий комментарий ветки (уже в эфире)
        if (options.direction === "next" && form.lastCommentId && cursorId >= form.lastCommentId) {
            return 0;
        }

        // Запрашиваем страницу у сервера
        let response = await getCommentsHistoryRequest({
            entity_id: form.postId,
            entity_type: "message",
            direction: options.direction,
            cursor_id: cursorId,
            offset: COMMENTS_PAGE_SIZE
        });

        // Комментарии страницы
        let comments = response.data?.comments ?? [];

        // Пустая страница вниз — конец потока: запечатываем границу, чтобы
        // больше не долбить сервер одним и тем же запросом
        if (comments.length === 0) {
            if (options.direction === "next") form.lastCommentId = cursorId;
            return 0;
        }

        // Сервер для `prev` отдаёт страницу по убыванию id — нормализуем
        // по возрастанию: лента всегда рисуется по возрастанию
        comments.sort((a, b) => a.id.localeCompare(b.id));

        // Обновляем границы ветки из ответа (старше/новее текущего окна)
        if (response.data) {
            if (response.data.first_comment_id) form.firstCommentId = response.data.first_comment_id;
            if (response.data.last_comment_id) form.lastCommentId = response.data.last_comment_id;
        }

        // Вставляем пачку в Store/DOM
        processAndAddComments(form, comments, options.direction);

        // Возвращаем количество добавленных комментариев (для добивки экрана)
        return comments.length;

    } catch (error) {
        Logger.error("[app][comments][load-more]", error);
        return 0;
    } finally {

        // Снимаем флаг подзагрузки
        form.isCommentsLoading = false;

    }

}

/**
 * ***************************************************************************
 * Вставка пачки комментариев в Store: защита от дублей (гонка пагинации и
 * live-событий) + направление вставки пробрасывается подписчикам item::added.
 * @param form - Экземпляр формы.
 * @param comments - Комментарии пачки (asc по id).
 * @param direction - Направление вставки ["prev" | "next"].
 * @returns void
 * ***************************************************************************
 */
function processAndAddComments(form: Comments, comments: CommentRecord[], direction: CommentsDirection): void {

    // invariant: id — строки, order by id <=> order by времени
    if (direction === "prev") {

        // Вставляем задом наперёд: каждая следующая строка prepend'ится выше
        const options: CommentStoreAddOptions = { direction: "prev" };
        for (let i = comments.length - 1; i >= 0; i--) {
            const current = comments[i];
            if (!current) continue;
            if (form.store.get(current.id)) continue; // Защита от дублей (WebSocket sync)
            form.store.add(current, options);
        }

    } else {

        const options: CommentStoreAddOptions = { direction: "next" };
        comments.forEach((current) => {
            if (form.store.get(current.id)) return; // Защита от дублей
            form.store.add(current, options);
        });

    }

}
