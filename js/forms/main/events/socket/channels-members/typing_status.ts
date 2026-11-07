// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем managers
import { activityStatusManager } from "../../../../../core/managers/set_activity_status.js";

// Импортируем типы
import { isRecord } from "../../../types.js";
import type { ActivityData } from "../../../../../core/managers/set_activity_status.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * Значение — нагрузка активности пользователя.
 *
 * Менеджер активности сам отбрасывает неполные данные, поэтому guard
 * сверяет только типы присутствующих полей: `unknown` не должен уходить
 * в типизированный `setActivity`.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку активности.
 */
function isActivityData(value: unknown): value is ActivityData {

    if (!isRecord(value)) return false;

    if (value.channel_id !== undefined && typeof value.channel_id !== "string") return false;
    if (value.user_id !== undefined && typeof value.user_id !== "string") return false;
    if (value.display_name !== undefined && typeof value.display_name !== "string") return false;

    return true;

}

/**
 * ***************************************************************************
 * Подписка на активность собеседников в канале (печатает, записывает
 * голосовое и т.п.): статусы показывает менеджер активности.
 * ***************************************************************************
 */
export function subscribeTypingStatus(): void {

    // ***************************************************************************
    // Статус активности пользователя
    // ***************************************************************************
    Socket.client.on("[channel-member]: typing status", (data) => {
        Logger.debug("[app][ws]::[channel-member]: typing status", data);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Работаем с состоянием
                activityStatusManager.setActivity(isActivityData(data) ? data : undefined);

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
