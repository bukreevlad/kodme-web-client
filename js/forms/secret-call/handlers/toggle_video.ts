// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем functions
import { setButtonIcon } from "../functions/set_button_icon.js";

// Импортируем типы
import type { SecretCall } from "../index.js";

/**
 * ***************************************************************************
 * toggleVideoHandler - включение и выключение камеры звонка; иконка
 * кнопки показывает текущее состояние.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function toggleVideoHandler(form: SecretCall): void {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        const enabled = manager.toggleVideo();
        const button = form.tpl?.querySelector(":scope [action-toggle-video]");
        setButtonIcon(button ?? null, enabled ? "video" : "video-off");

    } catch (error) {

        Logger.error("[app][secret-call]: ошибка переключения камеры:", error);
        Toast.error(window._lc.forms.secret_call.toasts.camera_error);

    }

}
