// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем forms
import { RemoveDialog } from "../../../messages/dialogs/remove-dialog/index.js";
import { Main } from "../../../main/index.js";
import { Messages } from "../../../messages/index.js";

// Импортируем requests
import { removeDialogRequest } from "../../../messages/requests/remove_dialog.js";

// Импортируем db
import { messagesTable, pendingMessagesTable } from "../../db.js";

// Импортируем типы
import type { ChannelItem } from "../channel.js";

/**
 * ***************************************************************************
 * Удалить диалог (с подтверждением): закрыть форму, убрать из списка
 * и вычистить сообщения из локальной БД.
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function removeDialogHandler(channel: ChannelItem): Promise<void> {

    try {

        // Если нет формы
        if (!channel) return;

        // Устанавливаем параметры
        const currentChannelId = channel.data.id;
        const channelType = channel.data.type;
        const isDialog = [1, 8].includes(channelType ?? -1);

        // Отображаем диалог
        new RemoveDialog({
            channelId: currentChannelId,
            forAllCheckbox: isDialog,
            callback: async (data) => {
                if (!data) return;

                // Отправляем запрос на сервер
                await removeDialogRequest({
                    channel_id: currentChannelId,
                    for_all: data?.for_all || false
                });

                // Поиск открытой формы диалога
                // Закрываем форму
                const messagesForm = Messages?.instances?.get(currentChannelId);
                if (messagesForm) {
                    messagesForm?.modal?.close();
                }

                // Удаляем из списка Store
                Main?.instance?.store?.remove(currentChannelId);

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
                Toast.success(window._lc.forms.main.components.channels.context_menu.toasts.success_remove_dialog, {
                    position: "bottom-center"
                });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
