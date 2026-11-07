// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем dialogs
import { ClearHistory } from "../dialogs/clear-history/index.js";

// Импортируем requests
import { clearHistoryRequest } from "../requests/clear_history.js";

// Импортируем типы
import type { Messages } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Открыть диалог очистки истории и по подтверждению очистить Store и IndexedDB.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function clearHistoryHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Устанавливаем параметры
        const currentChannelId = form.channelId;
        const channelType = form.channel?.type;
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

                // Очищаем Store
                form?.store?.removeAll();

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
                Toast.success(t("forms.messages.context_menu.toasts.success_clear_history"), { position: "bottom-center" });
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
