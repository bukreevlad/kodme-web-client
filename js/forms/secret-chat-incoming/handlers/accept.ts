// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем forms
import { SecretChat } from "../../secret-chat/index.js";
import { SecretChatIncoming } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * acceptChatHandler - принятие входящего приглашения: чат создаётся на этом
 * устройстве, открывается форма секретного чата.
 * @param form - Модалка входящего приглашения.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function acceptChatHandler(form: SecretChatIncoming): Promise<void> {

    try {

        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Принимаем приглашение: чат привязывается к этому устройству
        await manager.acceptChat(form.chatId);

        // Открываем секретный чат
        form.modal?.close();
        new SecretChat({ chatId: form.chatId });

    } catch (error) {

        Logger.error("[app][secret-chat-incoming]: ошибка принятия приглашения:", error);

        // Модалка могла закрыться (приняли на другом устройстве) — тостить
        // имеет смысл только пока она открыта
        if (!SecretChatIncoming.instances.has(form.chatId)) return;
        Toast.error(t("forms.secret_chat.toasts.invite_error"));
        form.modal?.close();

    }

}
