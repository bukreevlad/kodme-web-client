// Импортируем utils
import { toastError } from "../../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { VerifyChat } from "../index.js";

/**
 * ***************************************************************************
 * verifyHandler - подтверждение результата сверки ключей: сохранение статуса
 * верификации чата и закрытие диалога.
 * @param form - Экземпляр диалога.
 * @param verified - true — «Совпало», false — «Не совпало» / снять отметку.
 * @returns Promise, завершающаяся после сохранения.
 * ***************************************************************************
 */
export async function verifyHandler(form: VerifyChat, verified: boolean): Promise<void> {

    try {

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Сохраняем статус верификации (шапка обновится событием chat::updated)
        await manager.setVerified(form.chatId, verified);

        // Сообщение
        Toast.success(
            verified
                ? window._lc.forms.secret_chat_verify.toasts.verified
                : window._lc.forms.secret_chat_verify.toasts.unverified,
            { position: "bottom-center" }
        );

        // Закрываем диалог
        form.modal?.close();

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][secret-chat][verify]" });

    }

}
