// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем типы
import type { SecretCallIncoming } from "../index.js";

/**
 * ***************************************************************************
 * declineCallHandler - отказ от входящего звонка (hangup звонящему).
 * @param form - Модалка входящего звонка.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function declineCallHandler(form: SecretCallIncoming): Promise<void> {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        // Отказ: звонящему уходит hangup (если откажут все — он увидит «отклонён»)
        await manager.declineCall(form.callId);
        form.modal?.close();

    } catch (error) {
        Logger.error("[app][secret-call-incoming]: ошибка отказа от звонка:", error);
    }

}
