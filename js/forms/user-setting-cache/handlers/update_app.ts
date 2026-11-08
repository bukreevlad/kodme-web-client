// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingCache } from "../index.js";

/**
 * ***************************************************************************
 * Принудительное обновление приложения: снимает все регистрации Service
 * Worker, чистит кеш приложения с префиксом codeme::app:: и перезагружает
 * страницу.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function updateAppHandler(form: UserSettingCache): Promise<void> {

    try {

        // В основном коде приложения
        if ('serviceWorker' in navigator) {

            // Удаление всех зарегистрированных SW
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }

            // Очистка только кешей с префиксом codeme::app::
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName.startsWith('codeme::app::'))
                        .map(cacheName => caches.delete(cacheName))
                );
            }

            // Принудительная перезагрузка страницы
            window.location.reload();

        }

    } catch (error) {
        Logger.error(error);
    }

}
