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
 * Нагрузка ws-события блокировки участника.
 */
interface ModerationMemberPayload {

    /** Id канала. */
    channel_id: string;

    /** Id участника. */
    user_id: string;

}

/**
 * Значение — нагрузка блокировки/разблокировки участника.
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
 * Подписка на блокировку участника: состояние бана автора обновляется
 * в локальных сообщениях канала (для показа пункта «Разблокировать»).
 *
 * Самой жертве сервер дополнительно шлёт [channel]: remove] — канал у неё
 * вычищает существующий обработчик удаления канала.
 * @param asyncQueue - Общая очередь сообщений модерации.
 * ***************************************************************************
 */
export function subscribeModerationMemberBanned(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Помечаем сообщения автора забаненными
    // ***************************************************************************
    Socket.client.on("[moderation]: member banned", (data, timestamp) => {
        Logger.debug("[app][ws]::[moderation]: member banned", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isModerationMemberPayload(data)) return;

                // Обновляем состояние бана в локальных сообщениях автора
                await messagesTable()
                    .where("channel_id")
                    .equals(data.channel_id)
                    .and(message => message.created_user_id === data.user_id)
                    .modify({ author_is_blocked: true });

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
