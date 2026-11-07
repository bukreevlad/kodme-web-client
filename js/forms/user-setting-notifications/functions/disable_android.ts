// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { disablePushRequest } from "../requests/disable.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Отключение push-уведомлений внутри нативной Android-обёртки: удаляет
 * подписку на сервере (нативный слой отписывается сам при закрытии приложения).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function disableAndroid(form: UserSettingNotifications): Promise<void> {

    try {

        // Запрос
        const response = await disablePushRequest();

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.user_setting_notifications.toasts.success_disable);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Toast
        Toast.error(getErrorMessage(error), {
            duration: 0
        });

    }

}
