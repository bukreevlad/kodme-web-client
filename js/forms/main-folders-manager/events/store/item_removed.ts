// Импортируем типы
import { isMainFoldersManagerFolder } from "../../types.js";
import type { MainFoldersManager } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на удаление элемента из локального стора формы: обновляет
 * пустое состояние списка (DOM-копии строки стор снимает сам).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: MainFoldersManager): void {

    // Подписываемся на событие удаления элемента
    form.store.on("item::removed", (data) => {

        // Пейлоад типизирован как unknown: работаем только с записью папки
        if (!isMainFoldersManagerFolder(data)) return;

        // Обновляем пустое состояние
        form.updateEmptyState();

    });

}
