// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Comments } from "../../../../comments/index.js";

// Импортируем functions
import { markCommentRemoved } from "../../../../comments/functions/push_state.js";
import { applyCommentsCountDelta } from "./count_comments.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события удаления комментария.
 */
interface CommentRemovePayload {

    /** Id удалённого комментария. */
    id: string;

    /** Id канала поста. */
    channel_id?: string;

    /** Id поста-владельца. */
    entity_id: string;

    /** Тип сущности-владельца ("message"). */
    entity_type?: string;

}

/**
 * Значение — нагрузка удаления комментария.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isCommentRemovePayload(value: unknown): value is CommentRemovePayload {

    if (!isRecord(value)) return false;
    if (typeof value.id !== "string" || typeof value.entity_id !== "string") return false;
    if (value.channel_id !== undefined && typeof value.channel_id !== "string") return false;
    if (value.entity_type !== undefined && typeof value.entity_type !== "string") return false;

    return true;

}

/**
 * ***************************************************************************
 * Подписка на удаление комментария: счётчик поста уменьшается на 1, а строка
 * в открытой форме заменяется заглушкой «Комментарий удалён» (глобальное
 * удаление, локальной истории удалённых комментариев нет).
 * @param asyncQueue - Общая очередь комментариев (см. subscribeComments).
 * ***************************************************************************
 */
export function subscribeCommentsRemove(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Удаляем комментарий
    // ***************************************************************************
    Socket.client.on("[comment]: remove", (data, timestamp) => {
        Logger.debug("[app][ws]::[comment]: remove", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isCommentRemovePayload(data)) return;

                // Тип сущности поддерживается только "message" (см. comments/types.ts)
                if (data.entity_type != null && data.entity_type !== "message") return;

                // Счётчик поста -1 во всех случаях (форма открыта или нет)
                await applyCommentsCountDelta(data.entity_id, data.channel_id, -1);

                // Строка в открытой форме ветки заменяется заглушкой
                // (запись могла выпасть из окна — тогда удалять нечего)
                const form = Comments.instances.get(data.entity_id);
                if (form) markCommentRemoved(form, data.id);

            } catch (error) {
                Logger.error("[app][ws][comments][remove]", error);
            }

        });
    });
}
