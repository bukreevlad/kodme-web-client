// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { messageHistory } from "../functions/load_more_messages.js";

// Импортируем типы
import type { Messages } from "../index.js";

/** Кадр requestAnimationFrame, ожидающий обработки. */
let frame: number | null = null;

/** Последний вызов в текущем кадре (поддерживаем несколько форм). */
let pending: { form: Messages; container: Element; items: HTMLCollection } | null = null;

/**
 * ***************************************************************************
 * Обработать скролл списка сообщений: вычисления троттлятся через
 * requestAnimationFrame, пороги считаются только по сообщениям.
 * @param form - Экземпляр формы.
 * @param container - Контейнер (viewport) скролла.
 * @param items - Дети списка сообщений.
 * ***************************************************************************
 */
export function onContentScrollHandler(form: Messages, container: Element, items: HTMLCollection): void {

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
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Непосредственная обработка позиции скролла: подгрузка старых/новых
 * сообщений у краёв и переключение кнопки «прокрутить вниз».
 * @param form - Экземпляр формы.
 * @param container - Контейнер (viewport) скролла.
 * @param items - Дети списка сообщений.
 * ***************************************************************************
 */
function processScroll(form: Messages, container: Element, items: HTMLCollection): void {

    try {

        // Получаем BCR viewport
        const viewportRect = container.getBoundingClientRect();

        // Устанавливаем параметры
        let above = 0;
        let below = 0;

        // Проходим по элементам списка
        for (const el of items) {

            // В расчёт берём только сообщения
            if (!el.classList?.contains("item")) continue;

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
            messageHistory(form, { direction: "prev" });
        }

        // Вниз — подгружаем новые (если нужно)
        if (below < 15) {
            messageHistory(form, { direction: "next" });
        }

        // ====================================================

        // Скрытие/Отображение кнопки scrollDownBtn
        if (below < 1) {
            form.scrollDownBtn?.classList.remove("active");
        } else {
            form.scrollDownBtn?.classList.add("active");
        }

    } catch (error) {
        Logger.error(error);
    }

}
