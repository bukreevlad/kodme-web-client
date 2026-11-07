// Импортируем utils
import { getDeclension } from "../../../utils/string/declensions.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * updateCommentsCount - обновление счётчика комментариев в открытой форме:
 * поле поста (count_comments) и подзаголовок шапки «N комментариев».
 *
 * Вызывается обработчиками пушей `[comment]: new` / `[comment]: remove`
 * (forms/main/events/socket/comments/). Счётчик строки поста в Messages
 * обновляется отдельно (functions/apply_comment_push — стор + IndexedDB).
 * @param form - Экземпляр формы.
 * @param total - Новое число комментариев поста.
 * @returns void
 * ***************************************************************************
 */
export function updateCommentsCount(form: Comments, total: number): void {

    // Без формы или карточки поста (ответ [comment]: open ещё не пришёл)
    if (!form?.post) return;

    // Запоминаем в карточке поста: значение читают шапка и повторные открытия
    form.post.count_comments = total;

    // Подзаголовок шапки — числом и склонённым словом из локализации
    if (form.subtitle) {
        form.subtitle.textContent = `${total} ${getDeclension(total, window._lc.forms.comments.dec_comments)}`;
    }

}

/**
 * ***************************************************************************
 * setCommentingAllowed - переключение возможности комментирования в открытой
 * форме (пуш `[comment]: update post commenting`): футер скрывается/показывается.
 *
 * Уже загруженные комментарии остаются на месте — закрытые ветки читаются.
 * @param form - Экземпляр формы.
 * @param allowed - Разрешено ли комментирование.
 * @returns void
 * ***************************************************************************
 */
export function setCommentingAllowed(form: Comments, allowed: boolean): void {

    // Без формы или футера переключать нечего
    if (!form || !form.wrapFooter) return;

    // Запоминаем флаг: его читают ответы, отправка и контекстное меню
    form.isCommentingAllowed = allowed;

    // Скрываем/показываем футер (чтение ветки остаётся доступным)
    form.wrapFooter.classList.toggle("hidden", !allowed);

}

/**
 * ***************************************************************************
 * markCommentRemoved - замена строки комментария заглушкой «Комментарий
 * удалён».
 *
 * Удаление комментариев глобальное (`is_deleted`): сервер не присылает ни
 * текста, ни вложений, ни реакций — запись в Store затирается патчем, и
 * fillItem перерисовывает строку заглушкой. Вызывается обработчиком пуша
 * `[comment]: remove` и локальным обработчиком удаления.
 * @param form - Экземпляр формы.
 * @param id - Id комментария.
 * @returns void
 * ***************************************************************************
 */
export function markCommentRemoved(form: Comments, id: string): void {

    // Комментарий мог выпасть из окна ленты или быть удалён локально раньше
    const record = form?.store.get(id);
    if (!record) return;

    // Патч собираем отдельно: поля объявлены nullable, но exactOptionalPropertyTypes
    // требует явного присутствия ключа при передаче null
    const patch = {
        is_deleted: true,
        text: window._lc.forms.comments.removed_comment,
        attachments: null,
        reactions: [],
        reply_to_comment: null,
        reply_to_comment_id: null,
        edited_at: null
    };

    // item::updated перерисует строку (реакции/цитата/вложения очистятся сами)
    form.store.update(id, { ...record, ...patch });

}
