// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем forms
import { SecretCall } from "../../secret-call/index.js";
import { UserIsNotContact } from "../dialogs/user_is_not_contact.js";

// Импортируем типы
import type { UserProfile } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * startSecretCallHandler - секретный звонок из профиля пользователя:
 * вызов уходит всем онлайн-устройствам собеседника (presence виден только
 * контактам — без контакта показывается подсказка).
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function startSecretCallHandler(form: UserProfile): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Профиль загружается до открытия формы — без него делать нечего
        const profile = form.profile;
        if (!profile) return;

        // Менеджер звонков должен быть инициализирован (создаётся вместе с home)
        const manager = SecretCallsManager.instance;
        if (!manager) return;

        // Звонок требует контакта: presence-видимость устройств
        // собеседника доступна только контактам
        if (!profile.is_contact) {
            new UserIsNotContact();
            return;
        }

        // Уже идёт звонок — второй параллельно не поднимаем
        // (менеджер бросит ошибку — показываем её)
        const callId = await manager.startCall(form.userId);
        if (!callId) {
            Toast.warning(t("forms.secret_call.toasts.peer_offline"), { position: "bottom-center" });
            return;
        }

        // Закрываем профиль и открываем форму звонка
        form.modal?.close();
        new SecretCall({ callId });

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][user-profile][secret-call]" });

    }

}
