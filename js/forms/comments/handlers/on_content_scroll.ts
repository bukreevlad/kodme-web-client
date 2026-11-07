// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { commentsHistory } from "../functions/load_more_comments.js";

// Импортируем типы
import type { Comments } from "../index.js";

/** Кадр requestAnimationFrame, ожидающий обработки. */
let frame: number | null = null;

/** Последний вызов в текущем кадре (поддерживаем несколько форм). */
let pending: { form: Comments; container: Element; items: HTMLCollection } | null = null;

/**
 * ***************************************************************************
 * Обработать скролл ленты комментариев: вычисления троттлятся через
 * requestAnimationFrame, пороги считаются только по комментариям.
 * @param form - Экземпляр формы.
 * @param container - Контейнер (viewport) скролла.
 * @param items - Дети списка комментариев.
 * ***************************************************************************
 */
export function onContentScrollHandler(form: Comments, container: Element, items: HTMLCollection): void {

    try {

        // Если нет формы
        if (!form) return;

        // Запоминаем последний вызов в текущем кадре
        pending = { form, container, items };

        // Обработка уже запланирована в этом кадре
        if (frame) return;

        frame = requestAnimationFrame(() => {
            frame = null;

            // Берём самый свежий вызов кадра
            if (!pending) return;
            const { form: currentForm, container: currentContainer, items: currentItems } = pending;
            pending = null;

            processScroll(currentForm, currentContainer, currentItems);
        });

    } catch (error) {
        Logger.error("[app][comments][scroll]", error);
    }

}

/**
 * ***************************************************************************
 * Непосредственная обработка позиции скролла: подгрузка старых/новых
 * комментариев у краёв и переключение кнопки «прокрутить вниз».
 * @param form - Экземпляр формы.
 * @param container - Контейнер (viewport) скролла.
 * @param items - Дети списка комментариев.
 * ***************************************************************************
 */
function processScroll(form: Comments, container: Element, items: HTMLCollection): void {

    try {

        // Получаем BCR viewport
        const viewportRect = container.getBoundingClientRect();

        // Устанавливаем параметры
        let above = 0;
        let below = 0;

        // Проходим по элементам списка
        for (const el of items) {

            // В расчёт берём только комментарии
            if (!el.classList?.contains("comment-item")) continue;

            const rect = el.getBoundingClientRect();

            // полностью выше viewport
            if (rect.bottom < viewportRect.top) {
                above++;
                continue;
            }

            // полностью ниже viewport
            if (rect.top > viewportRect.bottom) {
                below++;
                continue;
            }
        }

        // Вверх — подгружаем старые
        if (above < 15) {
            commentsHistory(form, { direction: "prev" });
        }

        // Вниз — подгружаем новые (если нужно)
        if (below < 15) {
            commentsHistory(form, { direction: "next" });
        }

        // ====================================================

        // Скрытие/Отображение кнопки scrollDownBtn (пара hidden/flex:
        // в шаблоне кнопка участвует в flex-раскладке футера формы)
        if (below < 1) {
            form.scrollDownBtn?.classList.remove("active");
        } else {
            form.scrollDownBtn?.classList.add("active");
        }

    } catch (error) {
        Logger.error("[app][comments][scroll]", error);
    }

}
