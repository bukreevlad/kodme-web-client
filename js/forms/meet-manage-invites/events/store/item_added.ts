// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createInviteItem } from "../../components/invite.js";

// Импортируем типы
import { hasDirection, isMeetInvite } from "../../types.js";
import type { MeetManageInvites } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления приглашения в UI.
 *
 * Список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке —
 *   старые оказываются сверху;
 * - direction "next" и первая страница (direction не передан) — в конец
 *   (append): сервер отдаёт записи по возрастанию id.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: MeetManageInvites): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data, options) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isMeetInvite(data)) return;

            // Создаем DOM-элемент
            let item = createInviteItem(form, data);

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
