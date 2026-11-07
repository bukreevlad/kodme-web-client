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
 * Очистка всех таблиц в текущей IndexedDB.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function clearDatabase(form: UserSettingCache): Promise<void> {

    try {

        if (!IndexedDB.db) return;

        const tables = IndexedDB.db.tables;

        // Запускаем транзакцию или просто проходимся по всем таблицам и чистим
        await IndexedDB.db.transaction('rw', tables, async () => {
            for (const table of tables) {
                await table.clear();
            }
        });

        Logger.debug("[app][UserSettingCache]: Все таблицы IndexedDB успешно очищены");
        await loadStats(form); // Перезагружаем интерфейс

        // Toast
        Toast.success(window._lc.forms.user_setting_cache.toasts.database_cleared);

    } catch (error) {
        Logger.error("[app][UserSettingCache]: Ошибка очистки таблиц IndexedDB", error);

        // Toast
        Toast.error(window._lc.forms.user_setting_cache.toasts.database_clear_error);
    }

}
