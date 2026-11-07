// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем dialogs
import { RemoveComment } from "../../dialogs/remove_comment.js";

// Импортируем requests
import { removeCommentRequest } from "../../requests/remove_comment.js";

// Импортируем functions
import { markCommentRemoved } from "../../functions/push_state.js";

// Импортируем типы
import type { Comments } from "../../index.js";
import type { CommentRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * removeCommentHandler - удаление комментария: открывает диалог подтверждения
 * и выполняет удаление.
 *
 * Для исходящих комментариев (ошибка отправки) диалог не нужен — строка
 * убирается локально: сервер про неё ничего не знает.
 * @param form - Экземпляр формы.
 * @param data - Данные удаляемого комментария.
 * ***************************************************************************
 */
export async function removeCommentHandler(form: Comments, data: CommentRecord): Promise<void> {

    try {

        // Форма и комментарий обязательны
        if (!form || !data?.id) return;

        // Не отправленный комментарий удаляется локально без запроса
        if (data.is_error_sending || data.is_sending) {
            form.store.remove(data.id);
            return;
        }

        // Отображаем диалог подтверждения (вставляем в контент формы)
        new RemoveComment({
            insertInto: form.modal?.content ?? null,
            callback: async (confirmed) => {

                // Пользователь отменил удаление
                if (!confirmed) return;

                try {

                    // Запрос к API
                    await removeCommentRequest({
                        comment_id: data.id
                    });

                    // Строка заменяется заглушкой «Комментарий удалён»
                    // (глобальное удаление). Счётчик поста уменьшит пуш
                    // `[comment]: remove` — дублировать нельзя (риск -2)
                    markCommentRemoved(form, data.id);

                    // Сообщение
                    Toast.success(t("forms.comments.toasts.comment_removed"), { position: "bottom-center" });

                } catch (error) {

                    // Показываем причину пользователю
                    toastError(error, { context: "[app][comments][remove-comment]" });

                }
            }
        });

    } catch (error) {
        Logger.error("[app][comments][remove-comment]", error);
    }

}
