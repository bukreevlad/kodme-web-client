// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { withTimeout } from "./with_timeout.js";

// Импортируем requests
import { enableWebPushRequest } from "../requests/enable_web.js";

// Импортируем типы
import type { StoredSession } from "../../../utils/local_storage.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";
import type { UserSettingNotifications } from "../index.js";

/**
 * Сессия с серверными данными: поле `server` дописывается в сессию через
 * Object.assign при авторизации (см. sessions/handlers/check.ts) и отсутствует
 * в типе StoredSession.
 */
interface SessionWithServer extends StoredSession {

    /** Серверные данные сессии. */
    server?: {

        /** Публичный ключ Web Push. */
        web_push_public_key?: string;

    };

}

/**
 * ***************************************************************************
 * Включение web push-уведомлений: запрашивает разрешение браузера, создаёт
 * (или берёт существующую) push-подписку и регистрирует её на сервере.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function enableWeb(form: UserSettingNotifications): Promise<void> {

    try {

        // Сессия
        const session = LocalStorage.session;

        // Без сессии подписку включать не на чем
        if (!session) throw new Error(window._lc.forms.user_setting_notifications.toasts.not_access);

        // Проверяем доступ
        const access = await _access();
        if (!access) throw new Error(window._lc.forms.user_setting_notifications.toasts.not_access);

        // Получаем subscription
        const subscription = await _subscribe(session);

        // Устанавливаем значения
        const endpoint = subscription.endpoint;
        const p256dhKey = subscription.getKey("p256dh");
        const authKey = subscription.getKey("auth");

        // Ключи обязательны для push-подписки: null означает непригодную
        // подписку, регистрировать её на сервере не имеет смысла
        if (!p256dhKey || !authKey) throw new Error(window._lc.forms.user_setting_notifications.toasts.not_access);

        const key = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)));
        const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)));

        // Запрос
        const response = await enableWebPushRequest({
            endpoint: endpoint,
            key: key,
            auth: auth
        });

        // Проверка запроса
        if (response.status) {

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

// ***************************************************************************
// Проверяем доступ
// ***************************************************************************
async function _access(): Promise<boolean> {

    // Проверяем Notification
    if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;

}

/**
 * ***************************************************************************
 * Получение (или создание) push-подписки через Service Worker.
 * @param session - Сессия пользователя.
 * @returns Push-подписка браузера.
 * ***************************************************************************
 */
async function _subscribe(session: StoredSession): Promise<PushSubscription> {

    try {

        // Проверяем доступность SW
        if ("serviceWorker" in navigator) {

            // Получаем регистрацию SW с таймаутом
            // (строковый плейсхолдер "__SW_FILE_NAME__" подставляется
            // сборщиком в реальное имя SW — см. bun.build.js)
            const swRegistration = await withTimeout(
                navigator.serviceWorker.register("__SW_FILE_NAME__"),
                15000
            );

            // Получаем существующую подписку с таймаутом
            let subscription = await withTimeout(
                swRegistration.pushManager.getSubscription(),
                15000
            );

            // Если подписки еще нет, создаем ее
            if (!subscription) {
                Logger.debug("ℹ️ Создаем новую подписку...");

                // invariant: поле server дописывается в сессию при авторизации
                // (см. SessionWithServer) — читаем ключ подписки этим сужением
                const serverKey = (session as SessionWithServer).server?.web_push_public_key;

                // Создаем новую подписку с таймаутом
                subscription = await withTimeout(
                    swRegistration.pushManager.subscribe({
                        userVisibleOnly: true,
                        ...(serverKey !== undefined && { applicationServerKey: serverKey })
                    }),
                    15000
                );

                // Если после попытки подписки она все еще не создана
                if (!subscription) {
                    throw new Error(window._lc.forms.user_setting_notifications.toasts.not_access_push);
                }
            }

            // Теперь subscription либо существующая, либо новая
            return subscription;

        } else {
            throw new Error(window._lc.forms.user_setting_notifications.toasts.not_device);
        }

    } catch (error) {
        Logger.error("❌ Ошибка при подписке (возможно, таймаут):", getErrorMessage(error));
        throw error;
    }

}
