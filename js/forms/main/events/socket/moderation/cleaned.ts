// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../../utils/logs/logger.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";

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
 * Нагрузка ws-события чистки сообщений участника.
 */
interface ModerationCleanedPayload {

    /** Id канала. */
    channel_id: string;

    /** Id автора, чьи сообщения удалены. */
    user_id: string;

    /**
     * Контрольная точка синхронизации. Сервер отдаёт её bigint'ом, а
     * pg-драйвер сериализует int8 в строку ("69") — принимаем оба вида.
     */
    pts?: string | number;

}

/**
 * Значение — нагрузка чистки сообщений участника.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isModerationCleanedPayload(value: unknown): value is ModerationCleanedPayload {

    if (!isRecord(value)) return false;
    if (typeof value.channel_id !== "string" || typeof value.user_id !== "string") return false;

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
 * Применяет событие чистки сообщений участника к локальным хранилищам и UI:
 * записи автора вычищаются из локальной БД, у канала обновляется последнее
 * сообщение (в БД, сайдбаре и открытой форме).
 * @param data - Нагрузка события (id канала и id участника).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyModerationCleaned(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::messages_cleaned", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
        if (!isModerationCleanedPayload(data)) return;

        // Удаляем в IndexedDB сообщения автора канала
        await messagesTable()
            .where("channel_id")
            .equals(data.channel_id)
            .and(message => message.author_id === data.user_id)
            .delete();

        // ======================================

        // Получаем канал в IndexedDB
        const channelDB = await channelsTable().get(data.channel_id);
        if (channelDB) {

            // Если последнее сообщение принадлежало удалённому автору
            if (channelDB.last_message?.author_id === data.user_id) {

                // Запрашиваем последнее сообщение из канала
                const lastMessageDB = await messagesTable()
                    .where("channel_id")
                    .equals(data.channel_id)
                    .reverse()
                    .first();

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

        // Убираем сообщения автора из открытой формы
        const form = FormsRegistry.getOwner<Messages>(`messages:${data.channel_id}`);
        if (form) {
            for (const [id, item] of form.store.items) {
                if (item.author_id === data.user_id) {
                    form.store.remove(id);
                }
            }
        }

        // ======================================

        // Обновляем данные в сайдбаре (Main-инстанс создаётся при
        // старте приложения — без него обновить стор не получится)
        const mainForm = FormsRegistry.getOwner<Main>("main");
        if (!mainForm) return;

        const channelStore = mainForm.store.get(data.channel_id);

        // Если последнее сообщение в сайдбаре принадлежало удалённому автору
        if (channelStore && channelStore.last_message?.author_id === data.user_id) {

            // Запрашиваем последнее сообщение из канала
            const lastMessageDB = await messagesTable()
                .where("channel_id")
                .equals(data.channel_id)
                .reverse()
                .first();

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

        // ======================================
        // Визуальная сортировка каналов
        // ======================================

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
