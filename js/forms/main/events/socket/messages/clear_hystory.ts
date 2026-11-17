// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../../utils/logs/logger.js";
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
 * Применяет событие очистки истории к локальным хранилищам и UI: из
 * локальной БД удаляются сообщения канала (включая отложенные), у канала
 * сбрасывается последнее сообщение, открытый диалог очищает список.
 * @param data - Нагрузка события (id канала).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyClearHistory(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::history_cleared", data);

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

            // Сбрасываем последнее сообщение, так как история пуста
            // (патч: удалённый параллельно канал не «воскресает»)
            await channelsTable().update(channelDB.id, {
                last_message_id: null,
                last_message: null
            });
        }

        // Обновление графического интерфейса (открытая форма)
        const form = FormsRegistry.getOwner<Messages>(`messages:${targetChannelId}`);
        if (form) {
            form.store?.removeAll();
        }

        // Обновление списка чатов (main store)
        const mainForm = FormsRegistry.getOwner<Main>("main");
        const channelStore = mainForm?.store.get(targetChannelId);

        if (channelStore) {
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
}
