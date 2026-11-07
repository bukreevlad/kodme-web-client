// Импортируем utils
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { commentReactions } from "../comment_reactions.js";

// Импортируем requests
import { commentSendReactionRequest } from "../../requests/comment_send_reaction.js";

// Импортируем типы
import type { CommentReaction } from "../../types.js";
import type { Comments } from "../../index.js";

/**
 * ***************************************************************************
 * sendReactionHandler - отправка реакции на комментарий.
 *
 * Отправляет реакцию и сразу применяет ответ сервера: сервер возвращает
 * полный список реакций комментария, поэтому пользователь видит свою реакцию
 * мгновенно, не дожидаясь догоняющего поллинга `[comment]: get reactions`.
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки комментария.
 * @param reaction - Emoji реакция.
 * ***************************************************************************
 */
export async function sendReactionHandler(form: Comments, item: HTMLElement, reaction: string): Promise<void> {

    // Без строки или без id отправлять нечего (id берём из data-id — он
    // перепривязывается при replaceId после ack)
    const id = item?.dataset?.id;
    if (!form || !item || !id) return;

    try {

        // Запрос
        const response = await commentSendReactionRequest({
            comment_id: id,
            reaction: reaction
        });

        // Получаем реакции из ответа сервера
        const reactions: CommentReaction[] = response?.data || [];

        // Обновляем запись in-place (item::updated не нужен — строку ниже
        // перерисовываем точечно, без полного fillItem с пересборкой вложений)
        const record = form.store.get(id);
        if (record) record.reactions = reactions;

        // Перерисовываем блок реакций строки
        commentReactions(form, item, reactions);

    } catch (error) {

        // Раньше здесь был только Logger.error: клик по реакции выглядел
        // как «ничего не произошло» (например, при превышении лимита запросов)
        toastError(error, { context: "[app][comments][send-reaction]" });

    }

}
