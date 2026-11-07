// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { cleanStoreData } from "../../../../utils/helpers/clean_store_data.js";

// Импортируем components
import { createFooterReplyComment } from "../footer_reply_comment.js";

// Импортируем типы
import type { Comments } from "../../index.js";
import type { CommentRecord } from "../../types.js";

/**
 * ***************************************************************************
 * replyCommentHandler - ответ на комментарий: запоминает цитату у формы,
 * отрисовывает футер и ставит фокус в textarea.
 *
 * Ответ доступен только при разрешённом комментировании и для отправленных
 * комментариев (исходящие ещё не получили серверный id).
 * @param form - Экземпляр формы.
 * @param data - Данные комментария-ответа.
 * ***************************************************************************
 */
export async function replyCommentHandler(form: Comments, data: CommentRecord): Promise<void> {

    try {

        // Форма и комментарий обязательны
        if (!form || !data?.id) return;

        // Комментирование запрещено, комментарий ещё отправляется или уже
        // удалён (заглушка) — отвечать некому/нечего
        if (!form.isCommentingAllowed || data.is_sending || data.is_error_sending || data.is_deleted) return;

        // invariant: cleanStoreData возвращает копию записи без служебных ключей
        const cleanData = cleanStoreData(data) as CommentRecord;

        // Записываем комментарий-ответ
        form.replyComment = cleanData;

        // Снимаем режим редактирования (цитата и правка одновременно не ведутся)
        form.editedComment = null;
        if (form.editContainer) form.editContainer.innerHTML = "";

        // Отображаем комментарий в футере, на который отвечаем
        const reply = createFooterReplyComment(form, cleanData);

        // Очищаем контейнер и добавляем (без контейнера нечего наполнять)
        if (form.replyContainer) form.replyContainer.innerHTML = "";
        form.replyContainer?.appendChild(reply);

        // Устанавливаем фокус на textarea
        form.textarea?.focus();

    } catch (error) {
        Logger.error("[app][comments][reply-comment]", error);
    }

}
