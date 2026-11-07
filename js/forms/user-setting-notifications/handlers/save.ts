// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";
import { ElectronNotifications } from "../../../utils/electron_notifications.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveNotifySettingsRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение настроек уведомлений: закрытая форма при успехе, разбор кодов
 * ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function saveHandler(form: UserSettingNotifications): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const actionAccounts = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="action-accounts"]`);
    const calls = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="calls"]`);
    const messages = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="messages"]`);
    const comments = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="comments"]`);
    const replyMessage = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="reply-message"]`);

    // Поля обязаны входить в шаблон — иначе сохранять нечего
    if (!actionAccounts || !calls || !messages || !comments || !replyMessage) return;

    try {

        // Запрос
        const response = await saveNotifySettingsRequest({
            action_accounts: actionAccounts.checked,
            calls: calls.checked,
            messages: messages.checked,
            comments: comments.checked,
            reply_message: replyMessage.checked
        });

        // Проверка запроса
        if (response.status) {

            // Обновляем кеш настроек для нативных уведомлений Electron
            ElectronNotifications.cacheSettings({
                notify_action_accounts: actionAccounts.checked,
                notify_calls: calls.checked,
                notify_messages: messages.checked,
                notify_comments: comments.checked,
                notify_reply_message: replyMessage.checked
            });

            // Toast
            Toast.success(window._lc.forms.user_setting_notifications.toasts.success_saved);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если ошибка идентификатора пользователя
        if (getErrorMessage(error).includes("USER_ID_")) {

            // Toast
            Toast.error(window._lc.forms.user_setting_notifications.toasts.save_error);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
