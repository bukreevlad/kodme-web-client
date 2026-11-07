// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { commentsHistory } from "../functions/load_more_comments.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Кнопка «прокрутить вниз». Если самый свежий комментарий уже в окне —
 * просто скроллим вниз; если ушли далеко в истории — добираем хвост ветки.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после прокрутки.
 * ***************************************************************************
 */
export async function scrollDownHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Если последнего комментария ветки нет в окне — добираем хвост
        const hasTail = form.lastCommentId != null && form.store.get(form.lastCommentId);
        if (!hasTail) {
            await commentsHistory(form, { direction: "next" });
        }

        // Прокручиваем в самый низ
        form.listScrollManager?.scrollToBottom("smooth");

    } catch (error) {
        Logger.error("[app][comments][scroll-down]", error);
    }

}
