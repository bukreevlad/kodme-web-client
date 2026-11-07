// Импортируем components
import { createFolderItem } from "../../components/folder.js";

// Импортируем типы
import { isMainFoldersManagerFolder, hasDirection } from "../../types.js";
import type { MainFoldersManager } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка добавления папки в UI.
 *
 * Список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке —
 *   старые оказываются сверху;
 * - direction "next" и первая страница (direction не передан) — в конец
 *   (append): сервер отдаёт папки по возрастанию id.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: MainFoldersManager): void {

    // Подписываемся на событие добавления нового элемента.
    // Стор локальный (живёт вместе с формой), утечки подписки нет
    form.store.on("item::added", (data, options) => {

        // Пейлоад типизирован как unknown: строку создаём только для записи папки
        if (!isMainFoldersManagerFolder(data)) return;

        // Создаем DOM-элемент
        let item = createFolderItem(form, data);

        // Добавляем в список с учётом направления
        if (hasDirection(options) && options.direction === "prev") {
            form.list?.prepend(item);
        } else {
            form.list?.appendChild(item);
        }

        // Обновляем пустое состояние
        form.updateEmptyState();

    });

}