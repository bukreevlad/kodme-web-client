// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Main } from "../../main/index.js";

// Импортируем requests
import { unsubscribeChannelRequest } from "../requests/unsubscribe_channel.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Отписаться от канала: запрос на сервер, очистка Store и IndexedDB
 * (канал + все его темы + сообщения).
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после очистки.
 * ***************************************************************************
 */
export async function unsubscribeChannelHandler(form: Messages): Promise<void> {

    try {

        // Запрос на сервер
        await unsubscribeChannelRequest({ channel_id: form.channelId });

        // Сохраняем ID канала
        const targetChannelId = form.channelId;

        // Очищаем локальную БД (IndexedDB)
        IndexedDB.enqueue(async () => {

            // Если не переданы параметры
            if (!IndexedDB.db || !targetChannelId) return;

            try {

                // Находим все топики этой группы в БД
                const topics = await IndexedDB.db.table("channels")
                    .where("topic_for_group_id")
                    .equals(targetChannelId)
                    .toArray();

                // Собираем все ID, которые подлежат зачистке (канал + все его топики)
                const allTargetIds = [targetChannelId, ...topics.map((t: { id: string }) => t.id)];

                // Удаляем сообщения для всех найденных ID
                for (const id of allTargetIds) {

                    // Удаляем из Store (основной канал и топики)
                    Main.instance?.store.remove(id);

                    // Безопасное удаление основных сообщений
                    const msgKeys = await IndexedDB.db.table("messages")
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();

                    if (msgKeys.length > 0) {
                        await IndexedDB.db.table("messages").bulkDelete(msgKeys);
                    }

                    // Безопасное удаление временных сообщений
                    const pendingKeys = await IndexedDB.db.table("pending_messages")
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();

                    if (pendingKeys.length > 0) {
                        await IndexedDB.db.table("pending_messages").bulkDelete(pendingKeys);
                    }

                }

                // Удаляем сами записи каналов и топиков
                await IndexedDB.db.table("channels").bulkDelete(allTargetIds);

            } catch (err) {
                Logger.error("[IndexedDB Unsubscribe Error]:", err);
            }

        });

        // Удаляем из Store (основной канал)
        Main.instance?.store.remove(targetChannelId);

        // Закрываем форму
        form.modal?.close();

        // Toast
        Toast.success(window._lc.forms.messages.context_menu.toasts.success_unsubscribe, { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
