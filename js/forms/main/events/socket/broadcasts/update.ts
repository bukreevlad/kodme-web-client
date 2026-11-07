// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Broadcasts } from "../../../../broadcasts/index.js";
import { BroadcastPlay } from "../../../../broadcast-play/index.js";

// Импортируем типы
import { isRecord } from "../../../types.js";
import type { BroadcastCast } from "../../../../broadcast-play/types.js";

// Очередь выполнения socket событий
const asyncQueue = new AsyncQueue();

/**
 * Нагрузка ws-события обновления трансляции: id плюс частичные поля
 * трансляции (сервер присылает изменённые поля, структуру полей
 * задаёт контракт "[broadcast]: update").
 */
interface BroadcastUpdatePayload extends Partial<BroadcastCast> {

    /** Id трансляции. */
    id: string;

}

/**
 * Значение — нагрузка обновления трансляции.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isBroadcastUpdatePayload(value: unknown): value is BroadcastUpdatePayload {
    return isRecord(value) && typeof value.id === "string";
}

/**
 * ***************************************************************************
 * Подписка на обновление трансляции: изменённые поля мержатся поверх
 * текущих — в списке трансляций и в открытой форме воспроизведения.
 * ***************************************************************************
 */
export function subscribeBroadcastUpdate(): void {

    // ***************************************************************************
    // SocketEvent
    // ***************************************************************************
    Socket.client.on("[broadcast]: update", (data, timestamp) => {
        Logger.debug("[app][ws]::[broadcast]: update", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: мержим только известную структуру
                if (!isBroadcastUpdatePayload(data)) return;

                // Обновляем данне трансляции в списке
                const broadcastsForm = Broadcasts.instance;
                if (broadcastsForm) {

                    // Получаем Store и стрим
                    const store = broadcastsForm?.store;
                    if (store) {
                        const cast = store.get(data.id);

                        // Обновляем
                        if (cast) {
                            const updateCast = {
                                ...cast,
                                ...data
                            };
                            store.update(data.id, updateCast);
                        }
                    }

                }

                // Обновляем данне трансляции если она открыта
                const broadcastPlayForm = BroadcastPlay.instances.get(data.id);
                if (broadcastPlayForm) {

                    // Получаем стрим
                    const cast = broadcastPlayForm.cast;
                    if (cast) {
                        // Обновляем
                        const updateCast = {
                            ...cast,
                            ...data
                        };
                        broadcastPlayForm.update(updateCast);
                    }

                }

            } catch (error) {
                Logger.error(error);
            }

        });

    });

}
