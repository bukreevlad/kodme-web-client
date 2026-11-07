// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { copyText } from "../../../../utils/helpers/clipboard.js";

// Импортируем типы
import type { SecretChatMessageItem } from "../message.js";

/**
 * ***************************************************************************
 * copyMessageHandler - копирование текста сообщения в буфер обмена.
 * Текст секретного чата — открытый plaintext, экранировать не нужно.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function copyMessageHandler(message: SecretChatMessageItem): Promise<void> {

    try {

        // Пустое сообщение копировать нечего
        if (!message?.data?.text) return;

        // Копируем текст сообщения
        await copyText(message.data.text, {
            context: "[app][secret-chat][copy-message]",
            successText: window._lc.forms.secret_chat.toasts.message_copied
        });

    } catch (error) {

        // Этот catch — на случай синхронных ошибок
        Logger.error("[app][secret-chat][copy-message]:", error);

    }

}
