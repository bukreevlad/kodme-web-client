// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { withTimeout } from "./with_timeout.js";

// Импортируем requests
import { enableHmsPushRequest } from "../requests/enable_hms.js";
import { enableFcmPushRequest } from "../requests/enable_fcm.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Включение push-уведомлений внутри нативной Android-обёртки: запрашивает
 * push-токен у моста и регистрирует его на сервере у нужного провайдера
 * (HMS или FCM).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function enableAndroid(form: UserSettingNotifications): Promise<void> {

    try {

        // Получаем токен с таймаутом
        const subscription = await withTimeout(
            PlatformBridge.getPushToken(),
            15000
        );

        // Запрос (null — если токен получить не удалось или провайдер неизвестен)
        let response: Answer | null = null;

        // Если нет токена
        if (!subscription) {

            // Toast
            Toast.error(window._lc.forms.user_setting_notifications.toasts.not_access);

        } else {

            // Токен обязателен для регистрации на сервере (поле опционально
            // в ответе моста): без него запрос ушёл бы с пустым token
            const token = subscription.token;

            // Если токена нет — регистрировать нечего
            if (!token) {

                // Toast
                Toast.error(window._lc.forms.user_setting_notifications.toasts.not_access);

                // Если провайдер huawei
            } else if (subscription.provider === "hms") {

                // Запрос
                response = await enableHmsPushRequest({
                    token: token
                });

                // Если провайдер google
            } else if (subscription.provider === "fcm") {

                // Запрос
                response = await enableFcmPushRequest({
                    token: token
                });

            }

        }

        // Проверка запроса
        if (response && response?.status) {

            // Toast
            Toast.success(window._lc.forms.user_setting_notifications.toasts.success_enable);

            // Закрываем форму
            form.modal?.close();

        } else {

            // Toast
            Toast.error(window._lc.forms.user_setting_notifications.toasts.not_access_push);

        }

    } catch (error) {
        Logger.error(error);

        // Toast
        Toast.error(getErrorMessage(error), {
            duration: 0
        });

    }

}
