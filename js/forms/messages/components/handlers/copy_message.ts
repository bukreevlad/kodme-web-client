// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { unescapeHtml } from "../../../../utils/string/unescape_html.js";
import { copyText } from "../../../../utils/helpers/clipboard.js";

// Импортируем типы
import type { MessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * copyMessageHandler - копирование текста сообщения в буфер обмена.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function copyMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Пустое сообщение копировать нечего
        if (!message?.data?.text) return;

        // Копируем текст сообщения.
        // Раньше промис navigator.clipboard «висел» без .catch(), и при отказе
        // (нет прав/не https) пользователь не видел ни тоста, ни ошибки —
        // try/catch не срабатывал, потому что отказ приходил в промис.
        await copyText(unescapeHtml(message.data.text), {
            context: "[app][messages][copy-message]",
            successText: t("forms.messages.components.messages.toasts.message_copied")
        });

    } catch (error) {

        // Этот catch — на случай синхронных ошибок (например, unescapeHtml)
        Logger.error("[app][messages][copy-message]:", error);

    }

}
