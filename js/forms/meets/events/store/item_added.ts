// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createMeetItem } from "../../components/meet.js";

// Импортируем типы
import { hasDirection, isMeetRecord } from "../../types.js";
import type { Meets } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления конференции в UI.
 *
 * Список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке —
 *   старые оказываются сверху;
 * - direction "next" и первая страница (direction не передан) — в конец
 *   (append): сервер отдаёт записи по возрастанию id.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function subscribeItemAdded(form: Meets): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data, options) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isMeetRecord(data)) return;

            // Создаем DOM-элемент
            let item = createMeetItem(form, data);

            // Добавляем в список с учётом направления
            if (hasDirection(options) && options.direction === "prev") {
                form.list?.prepend(item);
            } else {
                form.list?.appendChild(item);
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
