// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем dialogs
import { RemoveDialog } from "../dialogs/remove-dialog/index.js";

// Импортируем forms
import { Main } from "../../main/index.js";

// Импортируем requests
import { removeDialogRequest } from "../requests/remove_dialog.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Открыть диалог удаления и по подтверждению удалить диалог из Store и IndexedDB.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function removeDialogHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Устанавливаем параметры
        const currentChannelId = form.channelId;
        const channelType = form.channel?.type;
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

                // Закрываем форму
                form?.modal?.close();

                // Удаляем из списка Store
                Main?.instance?.store?.remove(currentChannelId);

                // Очищаем локальную БД (IndexedDB)
                IndexedDB.enqueue(async () => {

                    // Удаляем основные сообщения
                    await IndexedDB.db?.table("messages")
                        .where("channel_id")
                        .equals(currentChannelId)
                        .delete();

                    // Удаляем временные сообщения
                    await IndexedDB.db?.table("pending_messages")
                        .where("channel_id")
                        .equals(currentChannelId)
                        .delete();

                });

                // Уведомление
                Toast.success(window._lc.forms.messages.context_menu.toasts.success_remove_dialog, { position: "bottom-center" });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
