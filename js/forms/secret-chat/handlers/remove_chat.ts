// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем dialogs
import { RemoveChat } from "../dialogs/remove-chat/index.js";

// Импортируем типы
import type { SecretChat } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * removeChatHandler - удаление секретного чата: диалог подтверждения и
 * удаление у обоих участников (событие closeChat удаляет чат и у
 * собеседника, затем форма закрывается).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function removeChatHandler(form: SecretChat): Promise<void> {

    try {

        // Если не передана форма
        if (!form) return;

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Отображаем диалог
        new RemoveChat({
            chatId: form.chatId,
            callback: async () => {

                try {

                    // Удаление локально + control-кадр закрытия собеседнику
                    await manager.closeChat(form.chatId);

                    // Сообщение
                    Toast.success(t("forms.secret_chat.toasts.chat_removed"), { position: "bottom-center" });

                    // Закрываем форму: чата больше нет ни у кого
                    form.modal?.close();

                } catch (error) {

                    // Пользователь должен понимать, что произошло
                    toastError(error, { context: "[app][secret-chat][remove-chat]" });

                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
