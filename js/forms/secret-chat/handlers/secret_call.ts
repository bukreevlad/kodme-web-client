// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем forms
import { SecretCall } from "../../secret-call/index.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * startSecretCallHandler - секретный звонок из шапки открытого секретного
 * чата: вызов уходит всем онлайн-устройствам собеседника (звонок живёт
 * отдельно от чата — чат остаётся открытым позади).
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function startSecretCallHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы или чат не загружен — звонить не по чему
        if (!form) return;
        if (!form.chat) return;

        // Менеджер звонков должен быть инициализирован (создаётся вместе с home)
        const manager = SecretCallsManager.instance;
        if (!manager) return;

        // Вызов уходит всем онлайн-устройствам собеседника
        const callId = await manager.startCall(form.chat.peer_user_id);
        if (!callId) {
            Toast.warning(window._lc.forms.secret_call.toasts.peer_offline, { position: "bottom-center" });
            return;
        }

        // Открываем форму звонка (чат остаётся позади)
        new SecretCall({ callId });

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][secret-chat][secret-call]" });

    }

}
