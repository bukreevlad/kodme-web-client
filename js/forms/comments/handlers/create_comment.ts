// Импортируем utils
import { canSend } from "../../../utils/validation/message_validator.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { sendingComments } from "../functions/sending_comments.js";
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { createDraftComment, getDraftComment } from "../functions/draft_comment.js";
import { CommentList } from "../functions/comment_list.js";

// Импортируем типы
import type { CommentRecord, CommentStoreAddOptions } from "../types.js";
import type { Comments } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * createCommentHandler - отправка нового комментария.
 *
 * Порядок: проверка возможности комментирования → валидация текста/вложений
 * ДО создания записи (тост до pending) → автопрокрутка к хвосту (только если
 * пользователь сидел внизу) → черновик в Store → сброс поля → запуск цикла
 * отправки.
 *
 * Вложения могли быть импортированы в черновик раньше текста — они
 * переезжают из черновика в исходящий комментарий.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function createCommentHandler(form: Comments): Promise<void> {

    try {

        // Если формы нет
        if (!form) return;

        // Комментирование запрещено (футер скрыт, но Enter мог пройти мимо)
        if (!form.isCommentingAllowed) {
            Toast.warning(t("forms.comments.toasts.commenting_disabled"), { position: "bottom-center" });
            return;
        }

        // Текст и вложения (вложения могли лежать в черновике до набора текста)
        const text = form.textarea?.value ?? "";
        const draft = getDraftComment(form);
        const attachments = draft?.attachments ?? null;

        // Валидация ДО создания pending-записи: подсветка textarea + тост
        const validation = canSend({ text, attachments });

        if (!validation.isValid) {

            // Коды валидации — ключи локали forms.comments.toasts.*
            const toasts: Record<string, string> = { ...I18n.tree.forms.comments.toasts };
            let toastText = validation.code ? toasts[validation.code] : null;

            // Подстановка параметров ({{count}} и т.п.)
            for (const [key, value] of Object.entries(validation.params)) {
                toastText = toastText?.replaceAll(`{{${key}}}`, String(value)) ?? null;
            }

            Toast.warning(toastText || toasts.empty_message || t("forms.comments.toasts.empty_message"), { position: "bottom-center" });
            form.textarea?.classList.add("invalid");

            return;

        }

        // Автопрокрутка к новому комментарию — строго ДО вставки (считается
        // по последнему элементу, который ещё не изменился)
        form._stickToBottom = CommentList.isLastItemVisible(form);

        // Черновик заменяется исходящей записью: старую запись черновика
        // убираем из Store, чтобы не осталась «сирота»
        if (draft) {
            form.store.remove(draft.id);
            form.tempComment = null;
        }

        // Исходящий комментарий (текст обрезаем: валидация по нему уже прошла).
        // is_sending — метка очереди: именно её ищет getNextPendingComment
        const comment: CommentRecord = createDraftComment(
            form,
            text.trim(),
            attachments,
            form.replyComment ? form.replyComment.id : null
        );
        comment.is_sending = true;

        // Цитата ответа: объект предка переносим в запись — строка покажет
        // блок ответа сразу после вставки (с сервера reply_to_comment приходит
        // только с задержкой, при догрузке/эхо)
        if (form.replyComment) comment.reply_to_comment = form.replyComment;

        // Вставка в хвост ленты (direction пробрасывается подписчикам item::added)
        const addOptions: CommentStoreAddOptions = { direction: "next" };
        form.store.add(comment, addOptions);

        // Ждём эхо `[comment]: new` (сверка в обработчике пуша Этапа 7)
        if (!form.pendingIds) form.pendingIds = new Set();
        form.pendingIds.add(comment.id);

        // Сбрасываем поле (текст уже скопирован в исходящую запись), режим
        // ответа и его плашку в футере, затем пересчитываем состояние кнопок
        resetTextarea(form);
        form.replyComment = null;
        if (form.replyContainer) form.replyContainer.innerHTML = "";
        updateStateButtons(form);

        // Скроллим вниз к отправленному комментарию
        form.listScrollManager?.scrollToBottom("smooth");

        // Запускаем цикл отправки (защита от двойного запуска — внутри)
        sendingComments(form);

    } catch (error) {
        Toast.warning(t("forms.comments.toasts.send_failed"), { position: "bottom-center" });
    }

}
