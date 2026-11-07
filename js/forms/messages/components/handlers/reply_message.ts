// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { cleanStoreData } from "../../../../utils/helpers/clean_store_data.js";

// Импортируем components
import { createFooterReplyMessage } from "../footer_reply_message.js";

// Импортируем типы
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * replyMessageHandler - ответ на сообщение: запоминает цитату у формы,
 * отрисовывает футер и ставит фокус в textarea.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function replyMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Очистка данных для IndexedDB
        // invariant: cleanStoreData возвращает копию записи сообщения без служебных ключей
        const cleanData = cleanStoreData(message.data) as MessageRecord;

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
