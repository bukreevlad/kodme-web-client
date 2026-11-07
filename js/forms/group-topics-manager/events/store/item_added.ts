// Импортируем components
import { ThemeItem } from "../../components/topic.js";

// Импортируем типы
import { isGroupTopicRecord, hasDirection } from "../../types.js";
import type { GroupTopicsManager } from "../../index.js";

/**
 * ************************************************************************
 * event: Обработка добавления темы в UI.
 *
 * Список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке —
 *   старые оказываются сверху;
 * - direction "next" и первая страница (direction не передан) — в конец
 *   (append): сервер отдаёт записи по возрастанию id.
 *
 * @param form - Экземпляр формы.
 * ************************************************************************
 */
export function subscribeItemAdded(form: GroupTopicsManager): void {

    // Подписываемся на событие добавления нового элемента.
    // Стор локальный (живёт вместе с формой), утечки подписки нет
    form.store.on("item::added", (data, options) => {

        // Пейлоад типизирован как unknown: строку создаём только для записи темы
        if (!isGroupTopicRecord(data)) return;

        // Создаем DOM-элемент
        let item = new ThemeItem(form, data);

        // Добавляем в список с учётом направления
        if (hasDirection(options) && options.direction === "prev") {
            form.list?.prepend(item.element);
        } else {
            form.list?.appendChild(item.element);
        }

    });

}
