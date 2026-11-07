// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { cleanStoreData } from "../../../../utils/helpers/clean_store_data.js";
import { unescapeHtml } from "../../../../utils/string/unescape_html.js";

// Импортируем functions
import { updateStateButtons } from "../../functions/update_state_buttons.js";

// Импортируем components
import { createFooterEditComment } from "../footer_edit_comment.js";

// Импортируем типы
import type { Comments } from "../../index.js";
import type { CommentRecord } from "../../types.js";

/**
 * ***************************************************************************
 * editCommentHandler - начало редактирования комментария: подсветка строки,
 * перенос текста в textarea и футер редактирования.
 *
 * Редактировать может только автор (проверка прав — в контекстном меню);
 * вложения при редактировании не меняются.
 * @param form - Экземпляр формы.
 * @param data - Данные редактируемого комментария.
 * ***************************************************************************
 */
export async function editCommentHandler(form: Comments, data: CommentRecord): Promise<void> {

    try {

        // Форма и комментарий обязательны
        if (!form || !data?.id) return;

        // Снимаем подсветку с ранее редактируемого комментария
        if (form.editedComment) {
            const prevItem = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${form.editedComment.id}"]`);
            prevItem?.classList.remove("is-edited");
        }

        // Записываем редактируемый комментарий
        form.editedComment = data;

        // Подсвечиваем строку редактируемого комментария
        const item = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${data.id}"]`);
        item?.classList.add("is-edited");

        // Устанавливаем текст (без поля редактировать нечего)
        const textarea = form.textarea;
        if (!textarea) return;

        textarea.value = unescapeHtml(data.text ?? "");

        // Отображаем комментарий в футере редактирования
        const edit = createFooterEditComment(form, data);

        // Очищаем контейнер и добавляем (без контейнера нечего наполнять)
        if (form.editContainer) form.editContainer.innerHTML = "";
        form.editContainer?.appendChild(edit);

        // Снимаем режим ответа (цитата и правка одновременно не ведутся)
        form.replyComment = null;
        if (form.replyContainer) form.replyContainer.innerHTML = "";

        // Устанавливаем фокус на textarea
        textarea.focus();

        // Обновляем высоту текстового поля
        const textareaAutosize = form.textareaAutosize;
        if (textareaAutosize) {

            // Ожидаем отрисовку 1 кадра
            requestAnimationFrame(() => {
                textareaAutosize.update();
            });

        }

        // Переключаем кнопки на форме
        updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][comments][edit-comment]", error);
    }

}
