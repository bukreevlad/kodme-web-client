// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createMemberItem } from "../../components/member.js";

// Импортируем типы
import { isMemberRecord } from "../../types.js";
import type { ChannelMembers } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка добавления участника в UI.
 *
 * Список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке;
 * - direction "next" и первая страница — в конец (append).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: ChannelMembers): void {

    // Если форма не открыта
    if (!form) return;

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on("item::added", (data, options) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isMemberRecord(data)) return;

            // Создаем DOM-элемент
            const item = createMemberItem(form, data);

            // Добавляем в список с учётом направления
            if (options && "direction" in options && options.direction === "prev") {
                form.list?.prepend(item);
            } else {
                form.list?.appendChild(item);
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
