// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createCastItem } from "../../components/cast.js";

// Импортируем типы
import { hasDirection, isBroadcastCast } from "../../types.js";
import type { Broadcasts } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления трансляции в UI.
 *
 * Список «новые сверху»:
 * - direction "next" — пачка новее maxId, вставляется в НАЧАЛО (prepend);
 *   сервер отдаёт её по возрастанию id, и последовательный prepend
 *   складывает её в убывательном порядке — новые оказываются сверху;
 * - direction "prev" и первая страница (direction не передан) — в конец (append).
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemAdded(form: Broadcasts): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data, options) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isBroadcastCast(data)) return;

            // Создаем DOM-элемент
            let item = createCastItem(form, data);

            // Добавляем в список с учётом направления
            if (hasDirection(options) && options.direction === "next") {
                form.list?.prepend(item);
            } else {
                form.list?.appendChild(item);
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
