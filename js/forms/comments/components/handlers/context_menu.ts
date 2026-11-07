// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем functions
import { getSessionUserId } from "../../../main/functions/session_identity.js";

// Импортируем config
import { MESSAGES_REACTIONS } from "../../../../config/constants.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { replyCommentHandler } from "./reply_comment.js";
import { editCommentHandler } from "./edit_comment.js";
import { removeCommentHandler } from "./remove_comment.js";
import { sendReactionHandler } from "./send_reaction.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { Comments } from "../../index.js";
import type { CommentRecord } from "../../types.js";

/**
 * ***************************************************************************
 * contextMenuHandler - контекстное меню комментария: реакции, ответ,
 * редактирование и удаление (состав пунктов зависит от состояния комментария
 * и прав пользователя).
 * @param event - Событие (мышь или тач).
 * @param form - Экземпляр формы.
 * @param data - Данные комментария.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, form: Comments, data: CommentRecord): Promise<void> {

    try {

        // Форма и комментарий обязательны
        if (!form || !data?.id) return;

        // Удалённый комментарий (заглушка) — меню действий не открывается
        if (data.is_deleted) return;

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Строка комментария в DOM (id перепривязывается при replaceId)
        const item = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${data.id}"]`);

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // Id текущего пользователя (для проверки авторства и прав)
        const sessionUserId = getSessionUserId();

        // Исходящий комментарий (ещё без серверного id) — из меню доступно
        // только локальное удаление строки
        const isPending = Boolean(data.is_sending || data.is_error_sending);

        // ================================

        // menu item: сетка реакций
        const reactions = document.createElement("div");
        reactions.classList.add("grid", "grid-cols-6", "rounded-md", "bg-[var(--second-bg)]", "gap-2", "p-2", "mb-2", "text-2xl");

        // Создаем реакции
        MESSAGES_REACTIONS.forEach(r => {

            // Создаем реакцию
            const reaction = document.createElement("span");

            // Добавляем в контейнер
            reaction.textContent = r;
            reaction.classList.add("cursor-pointer", "font-emoji", "hover:bg-[var(--color-black)]/10", "active:bg-[var(--color-black)]/15", "dark:hover:bg-white/10", "dark:active:bg-white/15", "rounded-md");

            reactions.append(reaction);

            // Реакции ставятся только на отправленные комментарии
            reaction.addEventListener("click", () => {
                if (item && !isPending) sendReactionHandler(form, item, r);
                contextMenu.close();
            });

        });
        if (!isPending) menuItems.push(reactions);

        // ================================

        // menu item
        const reply = {
            text: window._lc.forms.comments.context_menu.reply,
            iconName: "arrow-back-up-double",
            onClick: () => {
                if (item) replyCommentHandler(form, data);
            }
        };
        if (!isPending && form.isCommentingAllowed && !form.editedComment) {
            menuItems.push(reply);
        }

        // ================================

        // menu item
        const edit = {
            text: window._lc.forms.comments.context_menu.edit,
            iconName: "pencil",
            onClick: () => {
                if (item) editCommentHandler(form, data);
            }
        };
        if ((data.created_user_id === sessionUserId) && !isPending) {
            menuItems.push(edit);
        }

        // ================================

        // menu item
        const remove = {
            text: window._lc.forms.comments.context_menu.remove,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeCommentHandler(form, data)
        };

        // Удаление: автор комментария, автор поста, владелец/модератор
        // сообщества (сервер проверяет по приоритету — здесь лишь фильтруем
        // заведомо недоступное, точное право определит сервер)
        const canDelete = data.created_user_id === sessionUserId
            || form.post?.created_user_id === sessionUserId
            || Boolean(data.is_moderator);

        if (canDelete && !data.is_sending) {
            menuItems.push(remove);
        }

        // ================================

        // Меню без пунктов не открываем (только сетка реакций уже добавлена —
        // пустое меню выглядело бы как баг)
        if (!menuItems.length) return;

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error("[app][comments][context-menu]", error);
    }

}
