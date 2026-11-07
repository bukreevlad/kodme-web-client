// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем forms
import { SecretCall } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * switchCameraHandler - переключение камеры (передняя/задняя).
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function switchCameraHandler(form: SecretCall): Promise<void> {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        await manager.switchCamera();

    } catch (error) {

        Logger.error("[app][secret-call]: ошибка переключения камеры:", error);

        // Форма могла закрыться — тостить уже некому
        if (SecretCall.instance !== form) return;
        Toast.error(t("forms.secret_call.toasts.camera_error"));

    }

}
