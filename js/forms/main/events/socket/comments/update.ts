// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";

// Импортируем forms
import { Comments } from "../../../../comments/index.js";

// Импортируем типы
import { isCommentRecord } from "../../../../comments/types.js";

/**
 * ***************************************************************************
 * Подписка на изменение комментария (редактирование): обновляется запись
 * в открытой форме ветки.
 *
 * Комментарии не кэшируются локально (без IndexedDB), поэтому выпавшие из
 * окна ленты записи не трогаются — при следующей догрузке они придут с
 * сервера уже свежими.
 * @param asyncQueue - Общая очередь комментариев (см. subscribeComments).
 * ***************************************************************************
 */
export function subscribeCommentsUpdate(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Обновляем комментарий
    // ***************************************************************************
    Socket.client.on("[comment]: update", (data, timestamp) => {
        Logger.debug("[app][ws]::[comment]: update", data, timestamp);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с записью комментария
                if (!isCommentRecord(data)) return;

                // Тип сущности поддерживается только "message" (см. comments/types.ts)
                if (data.entity_type != null && data.entity_type !== "message") return;

                // Id поста обязателен: без него комментарий не к чему привязать
                const entityId = data.entity_id;
                if (typeof entityId !== "string" || !entityId) return;

                // Запись обновляется только в открытой форме и только если строка
                // есть в окне ленты
                const form = Comments.instances.get(entityId);
                if (!form || !form.store.get(data.id)) return;

                // invariant: реакции в пуше отсутствуют — присваивание сохранит
                // локальный список, а item::updated перерисует строку
                form.store.update(data.id, data);

            } catch (error) {
                Logger.error("[app][ws][comments][update]", error);
            }

        });
    });
}
