// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Messages } from "../../../../messages/index.js";
import { Comments } from "../../../../comments/index.js";

// Импортируем functions
import { setCommentingAllowed } from "../../../../comments/functions/push_state.js";

// Импортируем db
import { messagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события переключения комментирования под постом.
 */
interface CommentUpdatePostCommentingPayload {

    /** Id канала поста. */
    channel_id: string;

    /** Id поста (сообщения). */
    message_id: string;

    /** Id поста-владельца (равен message_id). */
    entity_id?: string;

    /** Тип сущности-владельца ("message"). */
    entity_type?: string;

    /** Разрешено ли комментирование. */
    is_commenting: boolean;

}

/**
 * Значение — нагрузка переключения комментирования под постом.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isCommentUpdatePostCommentingPayload(value: unknown): value is CommentUpdatePostCommentingPayload {

    if (!isRecord(value)) return false;
    if (typeof value.channel_id !== "string" || typeof value.message_id !== "string") return false;
    if (typeof value.is_commenting !== "boolean") return false;
    if (value.entity_id !== undefined && typeof value.entity_id !== "string") return false;
    if (value.entity_type !== undefined && typeof value.entity_type !== "string") return false;

    return true;

}

/**
 * ***************************************************************************
 * Подписка на переключение комментариев под постом: обновляется флаг поста
 * (`Message.is_commenting`) в сторе открытого чата и в IndexedDB, а открытая
 * форма ветки скрывает/показывает футер ввода.
 *
 * Уже загруженные комментарии остаются на месте: закрытые ветки читаются.
 * @param asyncQueue - Общая очередь комментариев (см. subscribeComments).
 * ***************************************************************************
 */
export function subscribeCommentsUpdatePostCommenting(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Переключаем комментирование под постом
    // ***************************************************************************
    Socket.client.on("[comment]: update post commenting", (data, timestamp) => {
        Logger.debug("[app][ws]::[comment]: update post commenting", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
                if (!isCommentUpdatePostCommentingPayload(data)) return;

                // Тип сущности поддерживается только "message" (см. comments/types.ts)
                if (data.entity_type != null && data.entity_type !== "message") return;

                // ---------- Стор открытого чата ----------

                // invariant: реестр форм сообщений ключуется id канала; пост
                // мог выпасть из окна ленты — тогда обновлять нечего
                const messagesForm = Messages.instances.get(data.channel_id);
                if (messagesForm?.store.get(data.message_id)) {

                    // item::updated перерисует строку поста
                    messagesForm.store.update(data.message_id, { is_commenting: data.is_commenting });

                }

                // ---------- IndexedDB ----------

                try {

                    // Получаем закэшированный пост (может отсутствовать)
                    const stored = await messagesTable().get(data.message_id);
                    if (stored) {
                        await messagesTable().put({ ...stored, is_commenting: data.is_commenting });
                    }

                } catch (error) {

                    // Фоновое обновление кэша: ошибка БД не должна ронять обработку пуша
                    Logger.warn("[app][ws][comments]: не удалось обновить is_commenting в IndexedDB.", error);

                }

                // ---------- Открытая форма ветки ----------

                // Id поста-владельца равен message_id; entity_id приходит как
                // страховка в контракте
                const form = Comments.instances.get(data.entity_id ?? data.message_id);
                if (form) setCommentingAllowed(form, data.is_commenting);

            } catch (error) {
                Logger.error("[app][ws][comments][update-post-commenting]", error);
            }

        });
    });
}
