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
import { copyMessageHandler } from "./copy_message.js";
import { replyMessageHandler } from "./reply_message.js";
import { forwardMessageHandler } from "./forward_message.js";
import { editMessageHandler } from "./edit_message.js";
import { removeMessageHandler } from "./remove_message.js";
import { removeTemporaryMessageHandler } from "./remove_temporary_message.js";
import { removePendingMessageHandler } from "./remove_pending_message.js";
import { resendMessageHandler } from "./resend_message.js";
import { sendReactionHandler } from "./send_reaction.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * contextMenuHandler - контекстное меню сообщения: реакции, копирование,
 * пересылка, ответ, редактирование и удаление (состав пунктов зависит от
 * состояния сообщения и прав пользователя).
 * @param event - Событие (мышь или тач).
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, message: MessageItem): Promise<void> {

    try {

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // Id текущего пользователя (для проверки авторства и прав)
        const sessionUserId = getSessionUserId();

        // ================================

        // menu item
        let reactions = document.createElement("div");
        reactions.classList.add("grid", "grid-cols-6", "rounded-md", "bg-[var(--second-bg)]", "gap-2", "p-2", "mb-2", "text-2xl");

        // Создаем реакции
        MESSAGES_REACTIONS.forEach(r => {

            // Создаем реакцию
            let reaction = document.createElement("span");

            // Добавляем в контейнер
            reaction.textContent = r;
            reaction.classList.add("cursor-pointer", "font-emoji", "hover:bg-[var(--color-black)]/10", "active:bg-[var(--color-black)]/15", "dark:hover:bg-white/10", "dark:active:bg-white/15", "rounded-md");

            reactions.append(reaction);
            reaction?.addEventListener("click", () => {
                sendReactionHandler(message, r);
                contextMenu.close();
            });

        });
        menuItems.push(reactions);

        // ================================

        // menu item
        let copy = {
            text: window._lc.forms.messages.components.messages.context_menu.copy,
            iconName: "Copy",
            onClick: () => copyMessageHandler(message)
        };
        menuItems.push(copy);

        // ================================

        // menu item
        let reSend = {
            text: window._lc.forms.messages.components.messages.context_menu.resend,
            iconName: "send-2",
            onClick: () => resendMessageHandler(message)
        };
        if (message.data.is_error_sending && message.data.is_temporary) {
            menuItems.push(reSend);
        }

        // ================================

        // menu item
        let reply = {
            text: window._lc.forms.messages.components.messages.context_menu.reply,
            iconName: "arrow-back-up-double",
            onClick: () => replyMessageHandler(message)
        };
        if ((message.data.channel_type !== 3) &&
            (!message.data.is_error_sending && !message.data.is_temporary) &&
            (!message.form.editedMessage)
        ) {
            menuItems.push(reply);
        }

        // ================================

        // menu item
        let forward = {
            text: window._lc.forms.messages.components.messages.context_menu.forward,
            iconName: "arrow-forward-up-double",
            onClick: () => forwardMessageHandler(message)
        };
        menuItems.push(forward);

        // ================================

        // menu item
        let edit = {
            text: window._lc.forms.messages.components.messages.context_menu.edit,
            iconName: "pencil",
            onClick: () => editMessageHandler(message)
        };
        if ((message.data.created_user_id === sessionUserId) &&
            (!message.data.is_error_sending && !message.data.is_temporary) &&
            (!message.data.forwarded_to_message_id)
        ) {
            menuItems.push(edit);
        }

        // ================================

        // menu item
        let remove = {
            text: window._lc.forms.messages.components.messages.context_menu.remove,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeMessageHandler(message)
        };

        // Канал формы обязателен для проверки прав удаления — иначе
        // легаси падал в catch и меню не открывалось
        if (!message.form.channel) return;

        // Имеет ли право удалять "Для всех" в обычных группах/личках
        const canDelete =
            [1, 8].includes(message.form.channel.type) ||
            message.data.created_user_id === sessionUserId ||
            message.form.channel.created_user_id === sessionUserId ||
            (message.form.channel.is_moderator && message.form.channel.can_deleted_message);

        // Проверка
        if (!message.data.is_error_sending &&
            !message.data.is_temporary &&
            !message.data.is_pending &&
            canDelete) {
            menuItems.push(remove);
        }

        // ================================

        // menu item
        let removeTemporary = {
            text: window._lc.forms.messages.components.messages.context_menu.remove,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeTemporaryMessageHandler(message)
        };
        if (message.data.is_temporary && !message.data.is_pending) {
            menuItems.push(removeTemporary);
        }

        // ================================

        // menu item
        let removePending = {
            text: window._lc.forms.messages.components.messages.context_menu.remove,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removePendingMessageHandler(message)
        };
        if (message.data.is_pending) {
            menuItems.push(removePending);
        }

        // ================================

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
