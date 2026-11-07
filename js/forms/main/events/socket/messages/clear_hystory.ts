// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, messagesTable, pendingMessagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * Нагрузка ws-события очистки истории канала.
 */
interface ClearHistoryPayload {

    /** Id канала. */
    channel_id: string;

    /**
     * Контрольная точка синхронизации: сервер в этом событии её не
     * передаёт, поэтому значение не типизируется — на месте останется
     * прежнее выражение `Number(pts) || 0` (сброс в ноль).
     */
    pts?: unknown;

}

/**
 * Значение — нагрузка очистки истории.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isClearHistoryPayload(value: unknown): value is ClearHistoryPayload {
    return isRecord(value) && typeof value.channel_id === "string";
}

/**
 * ***************************************************************************
 * Подписка на очистку истории: из локальной БД удаляются сообщения канала
 * (включая отложенные), у канала сбрасываются последнее сообщение и PTS,
 * открытый диалог очищает список.
 * @param asyncQueue - Общая очередь сообщений (см. subscribeMessagesNew).
 * ***************************************************************************
 */
export function subscribeMessagesClearHistory(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Удаляем историю сообщений
    // ***************************************************************************
    Socket.client.on("[message]: clear history", (data, timestamp) => {
        Logger.debug("[app][ws]::[message]: clear history", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isClearHistoryPayload(data)) return;

                // Устанавливаем параметры
                const targetChannelId = data.channel_id;
                if (!targetChannelId) return;

                // Очистка indexeddb (сообщения)
                // Используем безопасный метод через primaryKeys, чтобы избежать DataError
                const messageKeys = await messagesTable()
                    .where("channel_id")
                    .equals(targetChannelId)
                    .primaryKeys();

                if (messageKeys.length > 0) {
                    await messagesTable().bulkDelete(messageKeys);
                }

                // Очищаем также временные сообщения
                const pendingKeys = await pendingMessagesTable()
                    .where("channel_id")
                    .equals(targetChannelId)
                    .primaryKeys();

                if (pendingKeys.length > 0) {
                    await pendingMessagesTable().bulkDelete(pendingKeys);
                }

                // Обновление канала в indexeddb (метаданные)
                const channelDB = await channelsTable().get(targetChannelId);
                if (channelDB) {

                    // Сервер не передаёт pts в событии очистки истории, поэтому
                    // сбрасываем контрольную точку синхронизации в ноль
                    channelDB.last_pts = Number(data.pts) || 0;

                    // Сбрасываем последнее сообщение, так как история пуста
                    channelDB.last_message_id = null;
                    channelDB.last_message = null;

                    await channelsTable().put(channelDB);
                }

                // Обновление графического интерфейса (открытая форма)
                const form = Messages.instances.get(targetChannelId);
                if (form) {
                    form.store?.removeAll();
                }

                // Обновление списка чатов (main store)
                const mainForm = Main.instance;
                const channelStore = mainForm?.store.get(targetChannelId);

                if (channelStore) {
                    channelStore.last_pts = Number(data.pts) || 0;
                    channelStore.last_message_id = null;
                    channelStore.last_message = null;

                    // Принудительно уведомляем Store об изменениях
                    mainForm?.store.update(channelStore.id, channelStore);

                }

            } catch (error) {
                Logger.error(error);

                // Если ошибка была вызвана IndexedDB
                if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
                    Toast.error(t("forms.main.toasts.storage_write_failed"));
                }
            }

        });

    });

}
