// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем типы
import type { SecretCall } from "../index.js";

/**
 * ***************************************************************************
 * hangupHandler - завершение звонка (или отмена исходящего). Форма
 * закрывается по событию завершения звонка — здесь только hangup.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function hangupHandler(form: SecretCall): void {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        manager.hangup();

    } catch (error) {
        Logger.error("[app][secret-call]: ошибка завершения звонка:", error);
    }

}
