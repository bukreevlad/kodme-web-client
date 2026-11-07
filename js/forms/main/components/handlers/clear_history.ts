// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем forms
import { ClearHistory } from "../../../messages/dialogs/clear-history/index.js";
import { Messages } from "../../../messages/index.js";

// Импортируем requests
import { clearHistoryRequest } from "../../../messages/requests/clear_history.js";

// Импортируем db
import { messagesTable, pendingMessagesTable } from "../../db.js";

// Импортируем типы
import type { ChannelItem } from "../channel.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Очистить историю сообщений канала (с подтверждением).
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function clearHistoryHandler(channel: ChannelItem): Promise<void> {

    try {

        // Если нет формы
        if (!channel) return;

        // Устанавливаем параметры
        const currentChannelId = channel.data.id;
        const channelType = channel.data.type;
        const isDialog = [1, 8].includes(channelType ?? -1);

        // Отображаем диалог
        new ClearHistory({
            channelId: currentChannelId,
            forAllCheckbox: isDialog,
            callback: async (data) => {
                if (!data) return;

                // Если это диалог — берем значение чекбокса. Если группа/канал — только для себя (false).
                const shouldRemoveForAll = isDialog ? !!data.for_all : false;

                // Отправляем запрос на сервер
                await clearHistoryRequest({
                    channel_id: currentChannelId,
                    for_all: shouldRemoveForAll
                });

                // Поиск открытой формы диалога
                // Очищаем Store
                const messagesForm = Messages?.instances?.get(currentChannelId);
                if (messagesForm) {
                    messagesForm?.store?.removeAll();
                }

                // Очищаем локальную БД (IndexedDB)
                IndexedDB.enqueue(async () => {

                    // Удаляем основные сообщения
                    await messagesTable()
                        .where("channel_id")
                        .equals(currentChannelId)
                        .delete();

                    // Удаляем временные сообщения
                    await pendingMessagesTable()
                        .where("channel_id")
                        .equals(currentChannelId)
                        .delete();

                });

                // Уведомление
                Toast.success(t("forms.main.components.channels.context_menu.toasts.success_clear_history"), {
                    position: "bottom-center"
                });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
