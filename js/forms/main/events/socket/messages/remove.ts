// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../../utils/logs/logger.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";
import { GroupTopics } from "../../../../group-topics/index.js";

// Импортируем functions
import { sortChatListVisually } from "../../../functions/sort_chat_list.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, messagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * Нагрузка ws-события удаления сообщения.
 */
interface MessageRemovePayload {

    /** Id канала. */
    channel_id: string;

    /** Id удалённого сообщения. */
    message_id: string;

    /**
     * Контрольная точка синхронизации. Сервер отдаёт её bigint'ом, а
     * pg-драйвер сериализует int8 в строку ("69") — принимаем оба вида.
     */
    pts?: string | number;

}

/**
 * Значение — нагрузка удаления сообщения.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isMessageRemovePayload(value: unknown): value is MessageRemovePayload {

    if (!isRecord(value)) return false;
    if (typeof value.channel_id !== "string" || typeof value.message_id !== "string") return false;

    // pts: число либо непустая цифровая строка (bigint в pg — это строка),
    // иначе payload не наш и событие не трогаем
    const pts = value.pts;
    const isPtsValid = pts === undefined
        || typeof pts === "number"
        || (typeof pts === "string" && /^\d+$/.test(pts));
    if (!isPtsValid) return false;

    return true;

}

/**
 * ***************************************************************************
 * Применяет событие удаления сообщения к локальным хранилищам и UI: запись
 * вычищается из локальной БД, у канала пересчитывается последнее сообщение
 * (в БД, сайдбаре и списке тем), открытый диалог убирает элемент из списка.
 * @param data - Нагрузка события (id канала и id удалённого сообщения).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyMessageRemove(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::message_deleted", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
        if (!isMessageRemovePayload(data)) return;

        // Удаляем в IndexedDB
        await messagesTable().delete(data.message_id);

        // Потребуется для обновления, если последнее сообщение было удалено
        let lastMessageDB = null;

        // ======================================

        // Получаем канал в IndexedDB
        const channelDB = await channelsTable().get(data.channel_id);
        if (channelDB) {

            // Если это последнее сообщение в канале
            if (channelDB.last_message_id === data.message_id) {

                // Запрашиваем последнее сообщение из канала
                lastMessageDB = await messagesTable()
                    .where("channel_id")
                    .equals(data.channel_id)
                    .reverse()
                    .first();

                // Если сообщение нашлось, обновляем данные канала
                if (lastMessageDB) {
                    channelDB.last_message = lastMessageDB;
                    channelDB.last_message_id = lastMessageDB.id;
                } else {
                    channelDB.last_message = null;
                    channelDB.last_message_id = null;
                }

            }

            // Патч: удалённый параллельно канал не «воскресает»
            await channelsTable().update(channelDB.id, {
                last_message_id: channelDB.last_message_id,
                last_message: channelDB.last_message
            });

        }

        // ======================================

        // Получаем instance формы
        const form = FormsRegistry.getOwner<Messages>(`messages:${data.channel_id}`);
        if (form) {
            form.store.remove(data.message_id);
        }

        // ======================================

        // Получаем канал из Main.Store
        // Main-инстанс создаётся при старте приложения — без него
        // обновить стор не получится
        const mainForm = FormsRegistry.getOwner<Main>("main");
        if (!mainForm) return;

        const channelStore = mainForm.store.get(data.channel_id);

        // Если это последнее сообщение в канале
        if (channelStore && channelStore?.last_message_id === data.message_id) {

            // Запрашиваем последнее сообщение из канала
            lastMessageDB = await messagesTable()
                .where("channel_id")
                .equals(data.channel_id)
                .reverse()
                .first();

            // Если сообщение нашлось, обновляем данные канала
            if (lastMessageDB) {
                channelStore.last_message = lastMessageDB;
                channelStore.last_message_id = lastMessageDB.id;
            } else {
                channelStore.last_message = null;
                channelStore.last_message_id = null;
            }

            // Обновляем данные в Store
            mainForm.store.update(channelStore.id, channelStore);

        }

        // Если это тема группы
        if (channelDB?.parent_channel_id) {

            // Обновляем тему в открытом списке тем
            const groupTopicsForm = FormsRegistry.getOwner<GroupTopics>(`group-topics:${channelDB.parent_channel_id}`);
            if (groupTopicsForm) {
                groupTopicsForm.store.update(channelDB.id, channelDB);
            }

            // Обновляем группу в главном сайдбаре (Main Store)
            const parentStore = mainForm.store.get(channelDB.parent_channel_id);

            // Если это последнее сообщение в канале
            if (parentStore && parentStore?.last_message_id === data.message_id) {

                // Запрашиваем последнее сообщение из канала
                lastMessageDB = await messagesTable()
                    .where("channel_id")
                    .equals(data.channel_id)
                    .reverse()
                    .first();

                // Если сообщение нашлось, обновляем данные канала
                if (lastMessageDB) {
                    parentStore.last_message = lastMessageDB;
                    parentStore.last_message_id = lastMessageDB.id;
                } else {
                    parentStore.last_message = null;
                    parentStore.last_message_id = null;
                }

                // Обновляем данные в Store
                mainForm.store.update(parentStore.id, parentStore);

            }

        }

        // ======================================
        // Визуальная сортировка каналов
        // ======================================

        // Получаем все списки в которых есть канал
        const foldersTabs = mainForm.foldersTabs;
        const currentIdFolder = foldersTabs?.currentId;
        const currentPane = currentIdFolder != null ? foldersTabs?.getPane(currentIdFolder) : undefined;
        const currentList = currentPane?.querySelector<HTMLElement>("[data-list]") ?? null;

        // Вызываем визуальную сортировку каналов в папках
        sortChatListVisually(currentList, mainForm.store);

        // ======================================

    } catch (error) {
        Logger.error(error);

        // Если ошибка была вызвана IndexedDB
        if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
            Toast.error(t("forms.main.toasts.storage_write_failed"));
        }
    }
}
