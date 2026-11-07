// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { IndexedDB } from "../../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем forms
import { Main } from "../../../main/index.js";
import { Messages } from "../../../messages/index.js";

// Импортируем requests
import { unsubscribeChannelRequest } from "../../../messages/requests/unsubscribe_channel.js";

// Импортируем db
import { channelsTable, messagesTable, pendingMessagesTable } from "../../db.js";

// Импортируем типы
import type { ChannelItem } from "../channel.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отписать канал (группу) от пользователя: убрать из списка, закрыть
 * открытую форму и вычистить из локальной БД канал вместе с темами.
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function unsubscribeChannelHandler(channel: ChannelItem): Promise<void> {

    try {

        // Запрос на сервер
        await unsubscribeChannelRequest({ channel_id: channel.data.id });

        // Сохраняем ID и ссылку на канал
        const targetChannelId = channel.data.id;

        // Удаляем из Store (основной канал)
        Main.instance?.store.remove(targetChannelId);

        // Закрываем форму
        const messagesForm = Messages?.instances.get(targetChannelId);
        if (messagesForm) {
            messagesForm.modal?.close();
        }

        // Очищаем локальную БД (IndexedDB)
        IndexedDB.enqueue(async () => {

            // Если не переданы параметры
            if (!IndexedDB.db || !targetChannelId) return;

            try {

                // Находим все топики этой группы в БД
                const topics = await channelsTable()
                    .where("topic_for_group_id")
                    .equals(targetChannelId)
                    .toArray();

                // Собираем все ID, которые подлежат зачистке (канал + все его топики)
                const allTargetIds = [targetChannelId, ...topics.map(t => t.id)];

                // Удаляем сообщения для всех найденных ID
                for (const id of allTargetIds) {

                    // Безопасное удаление основных сообщений
                    const msgKeys = await messagesTable()
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();

                    if (msgKeys.length > 0) {
                        await messagesTable().bulkDelete(msgKeys);
                    }

                    // Безопасное удаление временных сообщений
                    const pendingKeys = await pendingMessagesTable()
                        .where("channel_id")
                        .equals(id)
                        .primaryKeys();

                    if (pendingKeys.length > 0) {
                        await pendingMessagesTable().bulkDelete(pendingKeys);
                    }

                }

                // Удаляем сами записи каналов и топиков
                await channelsTable().bulkDelete(allTargetIds);

            } catch (err) {
                Logger.error("[IndexedDB Unsubscribe Error]:", err);
            }

        });

        // Toast
        Toast.success(t("forms.main.components.channels.context_menu.toasts.success_unsubscribe"), {
            position: "bottom-center"
        });

    } catch (error) {
        Logger.error(error);
    }

}
