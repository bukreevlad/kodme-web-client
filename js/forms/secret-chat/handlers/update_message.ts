// Импортируем utils
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Сохранить отредактированное сообщение: проверка текста, отправка правки
 * через менеджер (control-кадр msg_update зеркалит правку на устройстве
 * собеседника), сброс textarea.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после сохранения.
 * ***************************************************************************
 */
export async function updateMessageHandler(form: SecretChat): Promise<void> {

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
        const validation = canSend({ text });

        if (!validation.isValid) {

            // Подсвечиваем поле только для «пустого» текста
            if (validation.code === "empty_message") textarea.classList.add("invalid");

            Toast.warning(window._lc.forms.secret_chat.toasts[validation.code], {
                position: "bottom-center"
            });

            return;
        }

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Сохраняем правку локально и шлём собеседнику (control-кадр msg_update);
        // вложения сохраняет менеджер — правка текста их не стирает
        await manager.updateMessage(form.chatId, editedMessage.id, {
            text: text,
            reply_to: editedMessage.reply_to ?? null,
            duration: editedMessage.duration ?? null
        });

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
        toastError(error, { context: "[app][secret-chat][update-message]" });

    }

}
