// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем forms
import { SecretCall } from "../../secret-call/index.js";
import { SecretCallIncoming } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * acceptCallHandler - принятие входящего звонка: модалка закрывается,
 * открывается форма звонка (микрофон/камера запрашиваются менеджером).
 * @param form - Модалка входящего звонка.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function acceptCallHandler(form: SecretCallIncoming): Promise<void> {

    try {

        const manager = SecretCallsManager.instance;
        if (!manager) return;

        // Принимаем звонок: offer собеседника → answer, локальные дорожки
        await manager.acceptCall(form.callId);

        // Открываем форму звонка
        form.modal?.close();
        new SecretCall({ callId: form.callId });

    } catch (error) {

        Logger.error("[app][secret-call-incoming]: ошибка принятия звонка:", error);

        // Модалка могла закрыться (взяли на другом устройстве) — тостить
        // имеет смысл только пока она открыта
        if (!SecretCallIncoming.instances.has(form.callId)) return;
        Toast.error(t("forms.secret_call.toasts.media_error"));
        form.modal?.close();

    }

}
