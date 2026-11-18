// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { stripLocalAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * cancelEditCommentHandler - отмена редактирования комментария: снятие
 * подсветки строки, сброс черновика и состояния кнопок.
 * Неприкреплённые локальные файлы убираются из строки — иначе они останутся
 * «призраками» до перезагрузки.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function cancelEditCommentHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы или редактирование не активно
        if (!form?.editedComment) return;

        // Снимаем подсветку строки (класс ставится editCommentHandler)
        const item = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${form.editedComment.id}"]`);
        item?.classList.remove("is-edited");

        // Сбрасываем редактируемый комментарий (id нужен для чистки файлов)
        const editedId = form.editedComment.id;
        form.editedComment = null;
        if (form.editContainer) form.editContainer.innerHTML = "";

        // Убираем из строки неприкреплённые локальные файлы
        stripLocalAttaches(form, editedId);

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем отображение кнопок
        await updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][comments][cancel-edit]", error);
    }

}
