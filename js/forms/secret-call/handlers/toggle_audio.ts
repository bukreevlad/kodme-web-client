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
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * toggleAudioHandler - включение и выключение микрофона звонка; иконка
 * кнопки показывает текущее состояние.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function toggleAudioHandler(form: SecretCall): void {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        const enabled = manager.toggleAudio();
        const button = form.tpl?.querySelector(":scope [action-toggle-audio]");
        setButtonIcon(button ?? null, enabled ? "microphone" : "microphone-off");

    } catch (error) {

        Logger.error("[app][secret-call]: ошибка переключения микрофона:", error);
        Toast.error(t("forms.secret_call.toasts.mic_error"));

    }

}
