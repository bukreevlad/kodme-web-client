// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createThemeItem } from "../../components/themes.js";

// Импортируем типы
import { isThemeItem } from "../../types.js";
import type { Themes } from "../../index.js";

/**
 * ***************************************************************************
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
 * ***************************************************************************
 */
export function subscribeItemAdded(form: Themes): void {

    // Если форма не открыта
    if (!form) return;

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data, options) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isThemeItem(data)) return;

            // Создаем DOM-элемент
            const item = createThemeItem(form, data);

            // Добавляем в список с учётом направления: "prev" — пачка
            // старых записей в начало, остальное — в конец
            // (options стор прокидывает как есть, direction читаем через in)
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
