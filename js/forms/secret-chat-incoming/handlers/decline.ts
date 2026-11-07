// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { SecretChatIncoming } from "../index.js";

/**
 * ***************************************************************************
 * declineChatHandler - отказ от входящего приглашения (отказ уходит
 * инициатору, приглашение закрывается на всех его устройствах).
 * @param form - Модалка входящего приглашения.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function declineChatHandler(form: SecretChatIncoming): Promise<void> {

    try {

        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Отказ: инициатору уходит decline (если откажут все — он увидит «отклонено»)
        await manager.declineChat(form.chatId);
        form.modal?.close();

    } catch (error) {
        Logger.error("[app][secret-chat-incoming]: ошибка отказа от приглашения:", error);
    }

}
