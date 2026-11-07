// Импортируем utils
import { IndexedDB } from "../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../utils/helpers/clean_store_data.js";
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем requests
import { updateMessageRequest } from "../requests/update_message.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Сохранить отредактированное сообщение: проверка текста, запрос на сервер,
 * обновление IndexedDB и Store, сброс textarea.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после сохранения.
 * ***************************************************************************
 */
export async function updateMessageHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Редактируемое сообщение (без него обновлять нечего)
        const editedMessage = form.editedMessage;
        if (!editedMessage) return;

        // Получаем текст сообщения (без поля нечего отправлять)
        const textarea = form.textarea;
        if (!textarea) return;

        let text = textarea.value;
        text = text.trim();

        // Проверяем сообщение ДО отправки: текст с emoji/иероглифами можно
        // отправить, но нельзя отредактировать — ловим это заранее на клиенте.
        const validation = canSend({
            text,
            attachments: form.editedMessage?.attachments
        });

        if (!validation.isValid) {

            // Подсвечиваем поле только для «пустого» текста
            if (validation.code === "empty_message") textarea.classList.add("invalid");

            Toast.warning(window._lc.forms.messages.toasts[validation.code], {
                position: "bottom-center"
            });

            return;
        }

        // Создаем обновленное сообщение
        let updatedMessage = {
            ...form.editedMessage,
            text: text
        }

        // Очистка данных для IndexedDB
        let cleanData = cleanStoreData(updatedMessage);

        // Делаем запрос на сервер
        await updateMessageRequest({
            message_id: editedMessage.id,
            text: text
        });

        // Очищаем редактируемое сообщение
        form.replyMessage = null;
        form.editedMessage = null;
        if (form.editContainer) form.editContainer.innerHTML = "";
        if (form.replyContainer) form.replyContainer.innerHTML = "";

        // Обновляем данные в IndexedDB (без базы пропускаем — изменения
        // уже применены к Store формы)
        const db = IndexedDB.db;
        if (db) await db.table("messages").put(cleanData);

        // Обновляем сообщение в Store (без id записи не найти)
        if (updatedMessage.id != null) form.store.update(updatedMessage.id, updatedMessage);

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем отображение кнопок
        await updateStateButtons(form);

    } catch (error) {

        // Показываем причину пользователю
        toastError(error, { context: "[app][messages][update-message]" });

    }

}
