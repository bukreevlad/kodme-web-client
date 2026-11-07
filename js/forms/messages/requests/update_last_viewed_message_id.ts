// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем utils
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем forms
import { Main } from "../../main/index.js";
import { GroupTopics } from "../../group-topics/index.js";

// Импортируем functions
import { updateFolderUnread } from "../../main/functions/update_folder_unread.js";

/**
 * Данные отметки «прочитано до».
 */
export interface UpdateLastViewedData {

    /** Id канала. */
    id: string;

    /** Id последнего просмотренного сообщения. */
    message_id: string;

    /** Число непрочитанных после отметки. */
    total_unread_messages: number | string;

}

/**
 * ***************************************************************************
 * Отправить отметку «прочитано до» и синхронизировать локальные данные
 * (IndexedDB, Store главного экрана, бейджи папок).
 *
 * Про запросы модуля-обёртки здесь намеренно ничего нет: раньше стояла
 * глобальная `RequestsQueue` на модуль, и при двух открытых чатах запрос
 * одного канала мог быть «вытеснен» (QUEUE_SUPERSEDED) запросом другого.
 * Теперь ограничение частоты делает `functions/last_viewed_batcher.js`,
 * живущий на форме (у каждого чата свой счётчик и своя отметка).
 *
 * @param data - Данные отметки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений: её логирует
 *   и показывает вызывающий код (бэтчер).
 * ***************************************************************************
 */
export async function updateLastViewedMessageIdRequest(data: UpdateLastViewedData): Promise<void> {

    // Отправляем на сервер. Ошибку НЕ проглатываем: её логирует и показывает
    // вызывающий код (бэтчер) — так пользователь увидит причину.
    await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT).emitWithAck("[channel-member]: update last viewed message", {
        channel_id: data.id,
        message_id: data.message_id,
        total_unread_messages: data.total_unread_messages
    });

    // Локальные данные: обновляем всегда, даже если сервер ответил ошибкой —
    // иначе бейдж не исчезнет до следующего открытия чата
    await syncLocalState(data);

}

/**
 * ***************************************************************************
 * Синхронизировать отметку о прочтении по локальным хранилищам.
 * @param data - Данные отметки ({ id, message_id, total_unread_messages }).
 * @returns Promise, завершающийся после обновления хранилищ.
 * ***************************************************************************
 */
async function syncLocalState(data: UpdateLastViewedData): Promise<void> {

    // Канала нет в IndexedDB (например, только что вышел из аккаунта) — нечего обновлять
    const entityDB = await IndexedDB.db?.table("channels").get(data.id);

    if (entityDB) {

        entityDB.last_viewed_message_id = data.message_id;
        entityDB.total_unread_messages = data.total_unread_messages;
        await IndexedDB.db?.table("channels").put(entityDB);

        // Тема группы: уменьшаем счётчик у самой группы и убираем бейдж в списке тем
        if (entityDB.topic_for_group_id) {

            // Минусуем счетчик у ГРУППЫ
            const parentStore = Main.instance?.store?.get(entityDB.topic_for_group_id);
            if (parentStore) {
                // Поле типизировано как string | number — приводим к строке
                // перед parseInt (легаси-поведение обоих вариантов типа идентично)
                const current = parseInt(String(parentStore.total_unread_messages)) || 0;
                parentStore.total_unread_messages = current > 0 ? current - 1 : "";
                Main.instance?.store.update(parentStore.id, parentStore);
            }

            // Обновляем саму ТЕМУ в списке тем (чтобы бадж исчез)
            const groupTopicsForm = GroupTopics.instances.get(entityDB.topic_for_group_id);
            if (groupTopicsForm) {
                groupTopicsForm.store.update(data.id, entityDB);
            }

        }

    }

    // Счётчик в Store главного экрана
    const channelStore = Main.instance?.store?.get(data.id);
    if (channelStore) {

        channelStore.last_viewed_message_id = data.message_id;
        channelStore.total_unread_messages = data.total_unread_messages;
        Main.instance?.store.update(channelStore.id, channelStore);

        // Обновляем бейджи непрочитанных на вкладках папок
        if (Main.instance) updateFolderUnread(Main.instance);

    }

}
