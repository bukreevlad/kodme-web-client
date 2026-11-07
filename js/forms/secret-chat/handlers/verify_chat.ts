// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { VerifyChat } from "../dialogs/verify/index.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * verifyChatHandler - открытие диалога сверки ключей секретного чата
 * (эмодзи + отпечаток; статус верификации читает диалог).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function verifyChatHandler(form: SecretChat): void {

    try {

        // Если нет формы или чат не загружен — сверять нечего
        if (!form) return;
        if (!form.chat) return;

        // Отображаем диалог
        new VerifyChat({ chatId: form.chatId });

    } catch (error) {
        Logger.error(error);
    }

}
