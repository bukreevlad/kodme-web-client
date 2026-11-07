// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем utils
import { getSessionUserId, getSessionUserDisplayName } from "../../main/functions/session_identity.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { CommentRecord } from "../types.js";
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * createDraftComment - фабрика черновика комментария.
 *
 * Черновик — локальная запись Store: появляется в ленте сразу (с вложениями),
 * живёт только в памяти формы (решение по комментариям: без IndexedDB) и
 * уходит на сервер из очереди `sendingComments`. Общий для создания по
 * кнопке/Enter и импорта вложений (оба сценария строят черновик одинаково).
 * @param form - Экземпляр формы.
 * @param text - Текст комментария (из textarea либо пусто — только вложения).
 * @param attachments - Вложения (объект-мап по temp_id).
 * @param replyToCommentId - Id комментария-предка ответа (null — корневой).
 * @returns Запись черновика.
 * ***************************************************************************
 */
export function createDraftComment(
    form: Comments,
    text: string,
    attachments: AttachmentsRaw | null = null,
    replyToCommentId: string | null = null
): CommentRecord {

    return {
        id: Uuidv7(),
        entity_id: form.postId,
        entity_type: "message",
        created_user_id: getSessionUserId() ?? undefined,
        display_name: getSessionUserDisplayName(),
        channel_id: form.channelId,
        channel_type: 3,
        text: text,
        created_at: new Date().toISOString(),
        edited_at: null,
        reply_to_comment_id: replyToCommentId,
        attachments: attachments ?? {},
        // Черновик — НЕ очередь: флаг is_sending ставит createCommentHandler
        // в момент реальной отправки (иначе импорт вложений улетел бы на
        // сервер без команды пользователя)
        is_sending: false,
        is_error_sending: false
    };

}

/**
 * ***************************************************************************
 * Взять текущий черновик из Store формы.
 *
 * Черновик ищется по `form.tempComment` с проверкой актуальности в Store:
 * запись могла уйти на сервер (replaceId) либо быть удалённой — тогда
 * возвращается null и создаётся новый черновик.
 * @param form - Экземпляр формы.
 * @returns Запись черновика либо null.
 * ***************************************************************************
 */
export function getDraftComment(form: Comments): CommentRecord | null {

    // Черновика не было — так и отдаём null
    if (!form.tempComment) return null;

    // Запись могла уйти из Store (отправлена/удалена) — считаем черновика устаревшим
    if (!form.store.get(form.tempComment.id)) {
        form.tempComment = null;
        return null;
    }

    return form.tempComment;

}

/**
 * ***************************************************************************
 * Сохранить черновик в Store формы: создать запись либо обновить существующую.
 * @param form - Экземпляр формы.
 * @param comment - Запись черновика.
 * @returns void
 * ***************************************************************************
 */
export function setDraftComment(form: Comments, comment: CommentRecord): void {

    form.tempComment = comment;

    // Записи в Store нет — добавляем; есть — обновляем (импорт вложений
    // к уже висящему черновику)
    if (!form.store.get(comment.id)) {
        form.store.add(comment);
    } else {
        form.store.update(comment.id, comment);
    }

}
