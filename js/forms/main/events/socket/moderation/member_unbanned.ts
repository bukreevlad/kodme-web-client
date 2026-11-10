// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем db
import { messagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события разблокировки участника.
 */
interface ModerationMemberPayload {

    /** Id канала. */
    channel_id: string;

    /** Id участника. */
    user_id: string;

}

/**
 * Значение — нагрузка разблокировки участника.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isModerationMemberPayload(value: unknown): value is ModerationMemberPayload {

    return isRecord(value)
        && typeof value.channel_id === "string"
        && typeof value.user_id === "string";

}

/**
 * ***************************************************************************
 * Подписка на разблокировку участника: состояние бана автора снимается
 * в локальных сообщениях канала (для показа пункта «Забанить»).
 * @param asyncQueue - Общая очередь сообщений модерации.
 * ***************************************************************************
 */
export function subscribeModerationMemberUnbanned(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Снимаем пометку бана с сообщений автора
    // ***************************************************************************
    Socket.client.on("[moderation]: member unbanned", (data, timestamp) => {
        Logger.debug("[app][ws]::[moderation]: member unbanned", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isModerationMemberPayload(data)) return;

                // Снимаем пометку бана в локальных сообщениях автора
                await messagesTable()
                    .where("channel_id")
                    .equals(data.channel_id)
                    .and(message => message.created_user_id === data.user_id)
                    .modify({ author_is_blocked: false });

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
