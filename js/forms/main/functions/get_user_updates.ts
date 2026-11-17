// Импортируем сторонние пакеты

// Импортируем utils
import { v7 as uuidv7 } from "uuid";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUserUpdatesRequest } from "../requests/get_user_updates.js";

// Импортируем functions
import { applyUserFeedEvent } from "./apply_user_feed_event.js";
import { getConversations } from "./get_conversations.js";

// Импортируем db
import { getUserFeedUpts, pendingUserUpdatesTable, setUserFeedUpts } from "../db.js";

// Импортируем типы
import type { UserFeedEvent } from "../../../types/domain.js";
import type { Main } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Глобальный обработчик догоняющих обновлений личной ленты (появление и
 * исчезновение каналов у пользователя).
 *
 * Сервер отдаёт события того же формата, что и живой толчок `[user]: feed`,
 * и они применяются тем же аплайером. Пакет применяется отказоустойчиво:
 * запись о намерении ложится в БД до применения и удаляется после. Если
 * точка отрезана лентой (too_long) — список каналов перечитывается целиком.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function getUserUpdates(form: Main): Promise<void> {
    Logger.debug(`[app][GetUserUpdates]: Старт цикла синхронизации`);

    try {

        // Обрабатываем "зависшие" пакеты (WAL recovery)
        await processPendingUserUpdates();

        // Точка отсчёта: последний применённый upid личной ленты
        let upid = await getUserFeedUpts();

        Logger.debug(`[app][GetUserUpdates]: Запрос обновлений с upid ${upid}.`);

        // Запрос на сервер (страницами, пока сервер отдаёт данные)
        for (;;) {

            const response = await getUserUpdatesRequest({ upid, offset: 50 });

            // Без данных — синхронизация завершена
            if (!response.status || !response.data) break;

            // Устанавливаем параметры
            const { items, has_more, too_long, upid: serverUpts } = response.data;

            // Точка отрезана лентой: список каналов перечитывается целиком,
            // точка прыгает на серверную (события жизненного цикла не несут
            // истории — снапшот всегда достаточен)
            if (too_long) {
                Logger.debug(`[app][GetUserUpdates]: [SNAPSHOT] Точка отрезана, полный список каналов.`);
                await getConversations(form);
                await setUserFeedUpts(serverUpts);
                break;
            }

            // Применяем события (с запиской-намерением до применения)
            if (items && items.length > 0) {
                Logger.debug(`[app][GetUserUpdates]: Получено ${items.length} событий.`);

                // Создаем запись о намерении применить пакет (для отказоустойчивости)
                const pendingId = uuidv7();
                await pendingUserUpdatesTable().put({
                    id: pendingId,
                    data: items,
                    timestamp: Date.now()
                });

                // Применяем события (единый аплайер с живым толчком)
                await applyUserUpdates(items);

                // Удаляем запись о намерении после успешного применения
                await pendingUserUpdatesTable().delete(pendingId);

            } else {
                Logger.debug(`[app][GetUserUpdates]: Новых событий нет.`);
            }

            // Сервер отдал полный лимит — возможно, есть еще данные
            if (!has_more) break;
            upid = await getUserFeedUpts();

        }

        Logger.debug(`[app][GetUserUpdates]: Синхронизация успешно завершена`);

    } catch (error) {
        Logger.error(`[app][GetUserUpdates]: Критическая ошибка:`, error);
        if (getErrorName(error) === "QuotaExceededError") {
            Toast.error(t("forms.main.toasts.storage_overflow"));
        }
    }
}

/**
 * ***************************************************************************
 * Применить пакет событий личной ленты (каждое — через общий аплайер).
 * @param events - Пакет событий (в порядке возрастания upid).
 * ***************************************************************************
 */
async function applyUserUpdates(events: UserFeedEvent[]): Promise<void> {

    for (const event of events) {
        try {
            await applyUserFeedEvent(event, false);
        } catch (err) {
            Logger.error(`[app][GetUserUpdates]: Ошибка обработки события ${event.type}:`, err);
        }
    }

}

/**
 * ***************************************************************************
 * Восстановление при сбое: применение незавершённых пакетов событий
 * личной ленты.
 * ***************************************************************************
 */
async function processPendingUserUpdates(): Promise<void> {
    try {

        // Получаем отложенные обновления
        const pendingList = await pendingUserUpdatesTable().toArray();
        if (pendingList.length === 0) return;

        Logger.warn(`[app][GetUserUpdates]: [PendingUpdates] Найдено ${pendingList.length} пакетов.`);

        // Проходим и применяем обновления
        for (const pkg of pendingList) {
            await applyUserUpdates(pkg.data);
            await pendingUserUpdatesTable().delete(pkg.id);
        }

    } catch (e) {
        Logger.error(`[app][GetUserUpdates]: [PendingUpdates] Ошибка:`, e);
    }
}
