// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { getFolder } from "./get_folder.js";

// Импортируем типы
import type { Cloud } from "../index.js";

/**
 * Опции дозагрузки страницы.
 */
export interface LoadMoreOptions {

    /** Дозагрузка по ссылке (общий доступ). */
    shared?: boolean;

}

/**
 * ***************************************************************************
 * Дозагрузка следующей страницы файлов при прокрутке списка
 * (своё облако или общий доступ по ссылке).
 *
 * Гарды:
 * - `isFirstLoaded`/`sharedIsFirstLoaded` — скролл-пагинация не работает,
 *   пока не применена первая страница: во время навигации по папкам курсор
 *   и has_more межстранично устарели, и direction-запрос ушёл бы на новую
 *   папку со старым курсором;
 * - `hasMore`/`sharedHasMore` — конец данных;
 * - `isLoadingMore`/`sharedIsLoadingMore` — свой флаг у каждой вкладки.
 * @param form - Экземпляр формы.
 * @param options - Настройки загрузки.
 * ***************************************************************************
 */
export async function loadMore(form: Cloud, options: LoadMoreOptions = {}): Promise<void> {

    try {

        // Выставляем параметры
        let shared = options.shared || false;
        let hasMore = shared ? form.sharedHasMore : form.hasMore;
        let isFirstLoaded = shared ? form.sharedIsFirstLoaded : form.isFirstLoaded;
        let isLoading = shared ? form.sharedIsLoadingMore : form.isLoadingMore;

        // Первая страница не применена — курсора и has_more в состоянии нет
        if (!isFirstLoaded) {
            return;
        }

        // Если больше нет файлов или уже идёт загрузка — выходим
        if (!hasMore || isLoading) {
            return;
        }

        // Ставим флаг загрузки в своём контексте
        if (shared) {
            form.sharedIsLoadingMore = true;
        } else {
            form.isLoadingMore = true;
        }

        try {

            // Дозагружаем следующую страницу. fromScroll — путь скролла:
            // ошибка покажет тост с троттлингом, а не на каждый тик
            await getFolder(form, {
                shared: shared,
                direction: "next",
                cursor_id: shared ? form.sharedCursorId : form.cursorId,
                fromScroll: true
            });

        } finally {

            // Снимаем флаг загрузки
            if (shared) {
                form.sharedIsLoadingMore = false;
            } else {
                form.isLoadingMore = false;
            }

        }

    } catch (error) {
        Logger.error(error);
    }

}
