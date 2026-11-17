// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { unescapeHtml } from "../../../../utils/string/unescape_html.js";

// Импортируем functions
import { updateStateButtons } from "../../functions/update_state_buttons.js";

// Импортируем components
import { createFooterEditMessage } from "../footer_edit_message.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * editMessageHandler - начало редактирования сообщения: подсветка строки,
 * перенос текста в textarea и футер редактирования.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function editMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Если сообщение уже редактируется
        let isEditedMessage = message.form.editedMessage;
        if (isEditedMessage) {

            // Снимаем подсветку со старого редактируемого сообщения
            // (записи в сторе может уже не быть)
            message.form.store.getDomElements(isEditedMessage.id).forEach(element => {
                element.classList.remove("is-edited");
            });

        }

        // Записываем редактируемое сообщение
        message.form.editedMessage = message.data;

        // Подсвечиваем копии редактируемого сообщения
        message.form.store.getDomElements(message.data.id).forEach(element => {
            element.classList.add("is-edited");
        });

        // Устанавливаем элементы (без поля редактировать нечего)
        let textarea = message.form.textarea;
        if (!textarea) return;

        textarea.value = unescapeHtml(message.data.text ?? "");

        // Отображаем сообщение в footer на которое отвечаем
        let edit = createFooterEditMessage(message);

        // Очищаем контейнер и добавляем (без контейнера нечего наполнять)
        if (message.form.editContainer) message.form.editContainer.innerHTML = "";
        message.form.editContainer?.appendChild(edit);

        // Очищаем контейнер ответа и отменяем его
        message.form.replyMessage = null;
        if (message.form.replyContainer) message.form.replyContainer.innerHTML = "";

        // Устанавливаем фокус на textarea
        textarea.focus();

        // Обновляем высоту текстового поля
        const textareaAutosize = message.form.textareaAutosize;
        if (textareaAutosize) {

            // Ожидаем отрисовку 1 кадра
            requestAnimationFrame(() => {
                textareaAutosize.update();
            });

        }

        // Переключаем кнопки на форме
        updateStateButtons(message.form);

    } catch (error) {
        Logger.error(error);
    }

}
