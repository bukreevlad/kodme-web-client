// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { IndexedDB } from "../../../utils/indexed_db.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем типы
import type { UserSettingCache } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сбор и рендер статистики по хранилищу (квота, медиакеш, локальная БД).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function loadStats(form: UserSettingCache): Promise<void> {

    // Статистика рисуется в узлы шаблона — без него нечего заполнять
    const tpl = form.tpl;
    if (!tpl) return;

    try {

        // 1. Общая квота через Storage API
        const storageQuotaEl = tpl.querySelector("#storage-quota-content");

        // Узел квоты входит в шаблон — без него блок не заполнить
        if (!storageQuotaEl) return;

        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();

            // usage опционален в оценке браузера — без данных показываем 0
            storageQuotaEl.innerHTML = `
                <div class="flex justify-between">
                    <span class="text-secondary">${t("forms.user_setting_cache.used")}</span>
                    <span class="font-semibold">${formatBytes(estimate.usage ?? 0)}</span>
                </div>
            `;
        } else {
            storageQuotaEl.innerHTML = `<span class="">${t("forms.user_setting_cache.storage_api_not_supported")}</span>`;
        }

        // ============================

        // 2. Статистика по типам кеша (Cache API)
        const cacheStatsEl = tpl.querySelector("#cache-stats");

        // Узел статистики кеша входит в шаблон — без него блок не заполнить
        if (!cacheStatsEl) return;

        let cacheHtml = ``;

        if (CacheManager.isSupported()) {
            for (const type of CacheManager.types) {
                const cacheName = CacheManager.generateCacheName(type, form.sessionId);
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                let size = 0;

                // Создаем объект для быстрого поиска локализации
                const cacheTypesLocalization: Record<string, string> = {};
                I18n.tree.forms.user_setting_cache.caches_types.forEach(item => {
                    const entry = Object.entries(item)[0];
                    if (!entry) return;
                    const [key, value] = entry;
                    cacheTypesLocalization[key] = value;
                });

                // Подсчет размера (используем заголовки или fallback на размер blob)
                for (const req of keys) {
                    const res = await cache.match(req);
                    if (res) {
                        const contentLength = res.headers.get("content-length");
                        if (contentLength) {
                            size += parseInt(contentLength, 10);
                        } else {
                            const blob = await res.blob();
                            size += blob.size;
                        }
                    }
                }

                cacheHtml += `
                    <div class="flex flex-row justify-between items-center">
                        <div class="flex flex-col">
                            <span class="capitalize font-semibold">${cacheTypesLocalization[type] || type}</span>
                        </div>
                        <div class="flex gap-3 items-center">
                            <span class="text-secondary text-sm font-semibold">${formatBytes(size)}</span>
                            ${Buttons.transparent({
                    shape: "square",
                    attributes: [`action-clear-cache=${type}`, `${keys.length === 0 ? 'disabled' : ''}`],
                    text: t("forms.user_setting_cache.clear")
                })}
                        </div>
                    </div>
                `;
            }
        } else {
            cacheHtml = `<span class="opacity-70">${t("forms.user_setting_cache.cache_api_not_supported")}</span>`;
        }
        cacheStatsEl.innerHTML = cacheHtml;

        // ============================

        // 3. Статистика базы данных (IndexedDB / Dexie)
        const dbStatsEl = tpl.querySelector("#db-stats");

        // Узел статистики БД входит в шаблон — без него блок не заполнить
        if (!dbStatsEl) return;

        let dbHtml = ``;

        if (IndexedDB.db) {
            const tables = IndexedDB.db.tables;

            // Определяем группы таблиц
            const regularTables = ["channels", "messages", "pending_messages"];
            const pendingUpdatesTables = ["pending_updates"];

            // Создаем объект для быстрого поиска локализации
            const databaseNamesLocalization: Record<string, string> = {};
            I18n.tree.forms.user_setting_cache.database_names.forEach(item => {
                const entry = Object.entries(item)[0];
                if (!entry) return;
                const [key, value] = entry;
                databaseNamesLocalization[key] = value;
            });

            // Функция для создания блока таблиц
            const createTableBlock = async (tableNames: string[], blockTitle: string): Promise<string> => {
                let blockHtml = '';
                let hasContent = false;

                for (const tableName of tableNames) {
                    const table = tables.find(t => t.name === tableName);
                    if (table) {
                        const count = await table.count();
                        if (count > 0 || tableNames.includes(tableName)) { // Показываем даже пустые таблицы, если они есть в списке
                            hasContent = true;
                            blockHtml += `
                                <div class="flex justify-between items-center">
                                    <div class="flex flex-col">
                                        <span class="">${databaseNamesLocalization[tableName] || tableName}</span>
                                        <span class="text-secondary text-sm font-semibold">${count} ${t("forms.user_setting_cache.records_count")}</span>
                                    </div>
                                    ${Buttons.transparent({
                                shape: "square",
                                attributes: [`action-clear-table=${tableName}`, `${count === 0 ? 'disabled' : ''}`],
                                text: t("forms.user_setting_cache.clear")
                            })}
                                </div>
                            `;
                        }
                    }
                }

                if (hasContent) {
                    return `
                        <div class="db-block">
                            <div class="text-muted my-3">${blockTitle}</div>
                            <div class="flex flex-col gap-3">
                                ${blockHtml}
                            </div>
                        </div>
                    `;
                }
                return '';
            };

            // Собираем все блоки
            const blocks: string[] = [];

            // Блок 1: Обычные таблицы
            const regularBlock = await createTableBlock(regularTables, t("forms.user_setting_cache.regular_channels"));
            if (regularBlock) blocks.push(regularBlock);

            // Блок 2: Ожидающие обновления
            const pendingBlock = await createTableBlock(pendingUpdatesTables, t("forms.user_setting_cache.pending_updates"));
            if (pendingBlock) blocks.push(pendingBlock);

            // Объединяем все блоки
            if (blocks.length > 0) {
                dbHtml = `
                    <div class="flex flex-col gap-4">
                        ${blocks.join('')}
                    </div>
                `;
            } else {
                dbHtml = `<span class="">${t("forms.user_setting_cache.not_database_tables")}</span>`;
            }

        } else {
            dbHtml = `<span class="">${t("forms.user_setting_cache.database_not_initialized")}</span>`;
        }
        dbStatsEl.innerHTML = dbHtml;

    } catch (error) {
        Logger.error("[app][UserSettingCache]: Ошибка при загрузке статистики", error);
    }

}
