// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";
import { GroupTopics } from "../../../../group-topics/index.js";

// Импортируем db
import { channelsTable, cleanMessage, messagesTable } from "../../../db.js";

// Импортируем типы
import { isMessageRecord } from "../../../types.js";

/**
 * ***************************************************************************
 * Применяет событие обновления сообщения (правка/статусы) к локальным
 * хранилищам и UI: запись мержится в локальной БД, обновляется превью
 * последнего сообщения канала (в БД, сайдбаре и списке тем), открытый
 * диалог перерисовывает сообщение.
 * @param data - Нагрузка события (запись сообщения).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyMessageUpdate(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::message_edit", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с записью сообщения
        if (!isMessageRecord(data)) return;

        // Подготавливаем данные для IndexedDB (патч: удалённое параллельно
        // сообщение не «воскресает»)
        const cleanData = cleanMessage(data);
        await messagesTable().update(data.id, cleanData);

        // ======================================

        // Получаем канал из IndexedDB
        const channelDB = await channelsTable().get(data.channel_id);
        if (channelDB) {

            // Обновляем данные (патч: удалённый параллельно канал не «воскресает»)
            if (channelDB.last_message_id === data.id) {
                await channelsTable().update(channelDB.id, { last_message: cleanData });
            }

            // Если это тема — обновляем превью в списке тем и у родителя
            if (channelDB.parent_channel_id) {

                // Поиск формы GroupTopics
                const gtForm = FormsRegistry.getOwner<GroupTopics>(`group-topics:${channelDB.parent_channel_id}`);
                if (gtForm) gtForm.store.update(channelDB.id, channelDB);

                // Поиск группы
                const parentStore = FormsRegistry.getOwner<Main>("main")?.store.get(channelDB.parent_channel_id);
                if (parentStore && parentStore.last_message?.id === data.id) {
                    parentStore.last_message = data;
                    FormsRegistry.getOwner<Main>("main")?.store.update(parentStore.id, parentStore);
                }

            }
        }

        // ======================================

        // Поиск формы
        const form = FormsRegistry.getOwner<Messages>(`messages:${data.channel_id}`);
        if (form) {
            const isMessage = form.store.get(data.id);
            const isBottom = form.listScrollManager?.isAtBottom();
            if (isMessage) {
                form.store.update(data.id, { ...data, is_temporary: false });
            }

            // Если скролл был внизу
            if (isBottom) {
                form.listScrollManager?.scrollToBottom();
            }
        }

        // ======================================

        // Обновление канала
        const channelStore = FormsRegistry.getOwner<Main>("main")?.store.get(data.channel_id);

        // Если канал найден
        if (channelStore && !channelDB?.parent_channel_id) {
            if (channelStore.last_message_id === data.id) {
                channelStore.last_message = data;
                FormsRegistry.getOwner<Main>("main")?.store.update(channelStore.id, channelStore);
            }
        }

    } catch (error) {
        Logger.error(error);
    }
}
