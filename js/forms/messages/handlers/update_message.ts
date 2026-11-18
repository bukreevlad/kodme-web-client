// Импортируем utils
import { IndexedDB } from "../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../utils/helpers/clean_store_data.js";
import * as Attachments from "../../../utils/messages/attachments.js";
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { sendingMessages } from "../functions/sending_messages.js";

// Импортируем requests
import { updateMessageRequest } from "../requests/update_message.js";

// Импортируем типы
import type { MessageRecord } from "../types.js";
import type { Messages } from "../index.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранить отредактированное сообщение: проверка текста, запрос на сервер,
 * обновление IndexedDB и Store, сброс textarea.
 *
 * С новыми файлами сохранение уходит в очередь: файлы грузятся с прогрессом
 * на строке сообщения (задача is_edit), затем сервер получает update с текстом
 * и вложениями.
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

            // Коды валидации — ключи локали forms.messages.toasts.*
            const toasts: Record<string, string> = { ...I18n.tree.forms.messages.toasts };
            let toastText = toasts[validation.code] ?? null;

            // Подстановка параметров ({{count}} и т.п.)
            for (const [key, value] of Object.entries(validation.params)) {
                toastText = toastText?.replaceAll(`{{${key}}}`, String(value)) ?? null;
            }

            Toast.warning(toastText || I18n.tree.forms.messages.toasts.empty_message, {
                position: "bottom-center"
            });

            return;
        }

        // Есть ли НОВЫЕ файлы: они грузятся только по «Сохранить» — уходят
        // задачей очереди (is_edit) и обновляют это же сообщение
        const hasNewFiles = Attachments.normalize(editedMessage.attachments ?? [])
            .some((attach) => attach._file != null);

        if (hasNewFiles) {

            // Задача редактирования живёт в очереди под id сообщения:
            // личный прогресс каждого файла рисуется внутри его вложений
            const editTask: MessageRecord = {
                ...editedMessage,
                text: text,
                is_pending: true,
                is_temporary: false,
                is_edit: true
            };

            // Служебные поля записи (DOM-ссылки) в IndexedDB не сохраняем
            // (вызов без generic-ов — как в createMessageHandler: значение
            // чистится до unknown)
            await IndexedDB.db?.table("pending_messages").put(cleanStoreData(editTask));

            // Пока файлы грузятся — строка помечается отправляемой
            form.store.update(editedMessage.id, { is_pending: true });

            // Запускаем цикл очереди
            sendingMessages(form);

        } else {

            // Создаем обновленное сообщение
            let updatedMessage = {
                ...form.editedMessage,
                text: text
            }

            // Делаем запрос на сервер
            await updateMessageRequest({
                message_id: editedMessage.id,
                text: text
            });

            // Патчим текст в IndexedDB (удалённое параллельно сообщение
            // не «воскресает»). Без базы пропускаем — изменения уже
            // применены к Store формы
            const db = IndexedDB.db;
            if (db && updatedMessage.id != null) await db.table("messages").update(updatedMessage.id, { text });

            // Обновляем сообщение в Store (без id записи не найти)
            if (updatedMessage.id != null) form.store.update(updatedMessage.id, updatedMessage);

        }

        // Очищаем редактируемое сообщение
        form.replyMessage = null;
        form.editedMessage = null;
        if (form.editContainer) form.editContainer.innerHTML = "";
        if (form.replyContainer) form.replyContainer.innerHTML = "";

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем отображение кнопок
        await updateStateButtons(form);

    } catch (error) {

        // Показываем причину пользователю
        toastError(error, { context: "[app][messages][update-message]" });

    }

}
