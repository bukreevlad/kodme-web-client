// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { loadStats } from "./load_stats.js";

// Импортируем типы
import type { UserSettingCache } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Очистка кеша по типу (или всего медиакеша).
 * @param form - Экземпляр формы.
 * @param type - Тип кеша или "all".
 * ***************************************************************************
 */
export async function clearCache(form: UserSettingCache, type: string): Promise<void> {

    try {

        if (type === "all") {
            await CacheManager.clearSessionCache(form.sessionId);
            Logger.debug("[app][UserSettingCache]: Очищен весь медиакеш");
        } else {
            const cacheName = CacheManager.generateCacheName(type, form.sessionId);
            await caches.delete(cacheName);
            Logger.debug(`[app][UserSettingCache]: Кеш типа ${type} очищен`);
        }

        // Перезагружаем статистику для обновления UI
        await loadStats(form);

        // Toast
        Toast.success(t("forms.user_setting_cache.toasts.cache_cleared"));

    } catch (error) {
        Logger.error(`[app][UserSettingCache]: Ошибка очистки кеша (${type})`, error);

        // Toast
        Toast.error(t("forms.user_setting_cache.toasts.cache_clear_error"));
    }

}
