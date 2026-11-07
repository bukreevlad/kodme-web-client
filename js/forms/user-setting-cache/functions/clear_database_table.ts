// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { loadStats } from "./load_stats.js";

// Импортируем типы
import type { UserSettingCache } from "../index.js";

/**
 * ***************************************************************************
 * Очистка конкретной таблицы в IndexedDB.
 * @param form - Экземпляр формы.
 * @param tableName - Имя таблицы.
 * ***************************************************************************
 */
export async function clearDatabaseTable(form: UserSettingCache, tableName: string): Promise<void> {

    try {

        if (!IndexedDB.db) return;

        const table = IndexedDB.db.table(tableName);
        if (table) {
            await table.clear();
            Logger.debug(`[app][UserSettingCache]: Таблица ${tableName} успешно очищена`);
        }
        await loadStats(form); // Перезагружаем интерфейс

        // Toast
        Toast.success(window._lc.forms.user_setting_cache.toasts.table_cleared);

    } catch (error) {
        Logger.error(`[app][UserSettingCache]: Ошибка очистки таблицы ${tableName}`, error);

        // Toast
        Toast.error(window._lc.forms.user_setting_cache.toasts.table_clear_error);
    }

}
