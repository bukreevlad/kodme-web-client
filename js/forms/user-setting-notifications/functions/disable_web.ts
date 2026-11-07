// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { withTimeout } from "./with_timeout.js";

// Импортируем requests
import { disablePushRequest } from "../requests/disable.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Отключение web push-уведомлений: отписывает браузер от push-подписки и
 * удаляет подписку на сервере.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function disableWeb(form: UserSettingNotifications): Promise<void> {

    try {

        // Проверяем доступ
        const access = await _access();
        if (!access) throw new Error("Нет разрешения");

        // Отписываем устройство
        await _unsubscribe();

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

// ***************************************************************************
// Проверяем доступ
// ***************************************************************************
async function _access(): Promise<boolean> {

    try {

        // Проверяем serviceWorker
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            Logger.warn(window._lc.forms.user_setting_notifications.toasts.not_device);
            return false;
        }

        return true;

    } catch (error) {
        throw error;
    }

}

/**
 * ***************************************************************************
 * Отписка браузера от push-подписки (с таймаутами на каждый шаг, чтобы
 * зависший Service Worker не подвесил отключение).
 * @returns true, если подписка отсутствовала или успешно отписана.
 * @throws Ошибка, если браузер не подтвердил отписку.
 * ***************************************************************************
 */
async function _unsubscribe(): Promise<boolean> {

    try {

        // Получаем регистрацию Service Worker"а с таймаутом
        const registration = await withTimeout(navigator.serviceWorker.ready, 5000);

        // Получаем текущую подписку с таймаутом
        const subscription = await withTimeout(
            registration.pushManager.getSubscription(),
            5000
        );

        // Если подписка найдена
        if (subscription) {

            try {

                // Вызываем метод unsubscribe() с таймаутом
                const successful = await withTimeout(subscription.unsubscribe(), 5000);

                // Проверка
                if (successful) {
                    return true;
                } else {
                    throw new Error(window._lc.forms.user_setting_notifications.toasts.browser_not_unsubscribe);
                }

            } catch (e) {
                throw new Error(window._lc.forms.user_setting_notifications.toasts.browser_not_unsubscribe);
            }

        } else {
            return true;
        }

    } catch (error) {
        throw error;
    }

}
