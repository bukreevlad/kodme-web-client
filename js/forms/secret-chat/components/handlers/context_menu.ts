// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { copyMessageHandler } from "./copy_message.js";
import { replyMessageHandler } from "./reply_message.js";
import { editMessageHandler } from "./edit_message.js";
import { removeMessageHandler } from "./remove_message.js";
import { removeTemporaryMessageHandler } from "./remove_temporary_message.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { SecretChatMessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * contextMenuHandler - контекстное меню сообщения: копирование, ответ,
 * редактирование и удаление (состав пунктов зависит от авторства и статуса
 * сообщения; реакций и пересылки в секретных чатах нет).
 * @param event - Событие (мышь или тач).
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, message: SecretChatMessageItem): Promise<void> {

    try {

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // Статусы «ещё не ушло»: редактировать такое сообщение нельзя
        const isInOutbox = message.data.is_temporary === true
            || message.data.status === "queued"
            || message.data.status === "sending"
            || message.data.status === "failed";

        // ================================

        // menu item
        let copy = {
            text: t("forms.secret_chat.context_menu.copy"),
            iconName: "Copy",
            onClick: () => copyMessageHandler(message)
        };
        if (message.data.text) {
            menuItems.push(copy);
        }

        // ================================

        // menu item
        let reply = {
            text: t("forms.secret_chat.context_menu.reply"),
            iconName: "arrow-back-up-double",
            onClick: () => replyMessageHandler(message)
        };
        if (!message.form.editedMessage && !isInOutbox) {
            menuItems.push(reply);
        }

        // ================================

        // menu item
        let edit = {
            text: t("forms.secret_chat.context_menu.edit"),
            iconName: "pencil",
            onClick: () => editMessageHandler(message)
        };
        if (message.data.sender === "me" && message.data.type === "text" && !isInOutbox) {
            menuItems.push(edit);
        }

        // ================================

        // menu item
        let remove = {
            text: t("forms.secret_chat.context_menu.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeMessageHandler(message)
        };
        if (message.data.sender === "me" && !message.data.is_temporary) {
            menuItems.push(remove);
        }

        // ================================

        // menu item
        let removeTemporary = {
            text: t("forms.secret_chat.context_menu.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeTemporaryMessageHandler(message)
        };
        if (message.data.is_temporary) {
            menuItems.push(removeTemporary);
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
