// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createFooterReplyMessage } from "../footer_reply_message.js";

// Импортируем типы
import type { SecretChatMessageRecord } from "../../types.js";
import type { SecretChatMessageItem } from "../message.js";

/**
 * ***************************************************************************
 * replyMessageHandler - ответ на сообщение: запоминает цитату у формы,
 * отрисовывает футер и ставит фокус в textarea.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function replyMessageHandler(message: SecretChatMessageItem): Promise<void> {

    try {

        // Копия записи без служебных __...__-полей (чистая цитата)
        const cleanData: SecretChatMessageRecord = { ...message.data };
        delete cleanData.__domElements__;
        delete cleanData.__editMessage__;
        delete cleanData.__unsubscribeStore__;

        // Записываем сообщение на которое отвечаем
        message.form.replyMessage = cleanData;

        // Отображаем сообщение в footer на которое отвечаем
        let reply = createFooterReplyMessage(message);

        // Очищаем контейнер и добавляем
        if (message.form.replyContainer) message.form.replyContainer.innerHTML = "";
        message.form.replyContainer?.appendChild(reply);

        // Устанавливаем фокус на textarea
        let textarea = message.form.textarea;
        textarea?.focus();

    } catch (error) {
        Logger.error(error);
    }

}
