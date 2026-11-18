// Импортируем utils
import * as Attachments from "../../../utils/messages/attachments.js";
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { sendingComments } from "../functions/sending_comments.js";

// Импортируем requests
import { updateCommentRequest } from "../requests/update_comment.js";

// Импортируем типы
import type { Comments } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * updateCommentHandler - сохранение отредактированного комментария.
 *
 * Порядок (как в Messages): проверка текста → запрос на сервер → обновление
 * Store → сброс поля и режима редактирования. С новыми файлами сохранение
 * уходит в очередь: они грузятся с прогрессом на строке комментария (задача
 * is_edit), затем сервер получает update с текстом и вложениями.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после сохранения.
 * ***************************************************************************
 */
export async function updateCommentHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Редактируемый комментарий (без него обновлять нечего)
        const editedComment = form.editedComment;
        if (!editedComment) return;

        // Получаем текст комментария (без поля нечего отправлять)
        const textarea = form.textarea;
        if (!textarea) return;

        const text = textarea.value.trim();

        // Проверяем ДО отправки: пустой комментарий (текст удалили, а вложения
        // остались) отправить нельзя — ловим это заранее на клиенте
        const validation = canSend({
            text,
            attachments: editedComment.attachments
        });

        if (!validation.isValid) {

            // Подсвечиваем поле только для «пустого» текста
            if (validation.code === "empty_message") textarea.classList.add("invalid");

            // Коды валидации — ключи локали forms.comments.toasts.*
            const toasts: Record<string, string> = { ...I18n.tree.forms.comments.toasts };
            let toastText = validation.code ? toasts[validation.code] : null;

            // Подстановка параметров ({{count}} и т.п.)
            for (const [key, value] of Object.entries(validation.params)) {
                toastText = toastText?.replaceAll(`{{${key}}}`, String(value)) ?? null;
            }

            Toast.warning(toastText || toasts.empty_message || t("forms.comments.toasts.empty_message"), {
                position: "bottom-center"
            });

            return;

        }

        // Есть ли НОВЫЕ файлы: они грузятся только по «Обновить» — уходят
        // задачей очереди (is_edit) и обновляют этот же комментарий
        const hasNewFiles = Attachments.normalize(editedComment.attachments ?? [])
            .some((attach) => attach._file != null);

        if (hasNewFiles) {

            // Очередь комментариев живёт только в Store: прежний текст
            // остаётся в строке, новый едет в edit_text до ack
            form.store.update(editedComment.id, {
                is_sending: true,
                is_edit: true,
                edit_text: text
            });

            // Запускаем цикл очереди (личный прогресс каждого файла —
            // внутри его вложений строки)
            sendingComments(form);

        } else {

            // Делаем запрос на сервер (вложения не трогаем — только текст)
            await updateCommentRequest({
                comment_id: editedComment.id,
                text: text
            });

            // Обновляем комментарий в Store (item::updated перерисует строку;
            // edited_at проставит сервер через live-событие в Этапе 6)
            form.store.update(editedComment.id, {
                ...editedComment,
                text: text
            });

        }

        // Очищаем режим редактирования: снимаем подсветку строки (парность
        // с cancelEditCommentHandler — класс ставит editCommentHandler)
        const item = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${editedComment.id}"]`);
        item?.classList.remove("is-edited");

        form.editedComment = null;
        if (form.editContainer) form.editContainer.innerHTML = "";

        // Сбрасываем textarea
        resetTextarea(form);

        // Обновляем отображение кнопок
        updateStateButtons(form);

    } catch (error) {

        // Показываем причину пользователю
        toastError(error, { context: "[app][comments][update-comment]" });

    }

}
