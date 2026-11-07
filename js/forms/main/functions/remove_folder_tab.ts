// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Main } from "../index.js";

/**
 * ***************************************************************************
 * Удалить папку из вкладок главной формы.
 * @param form - Экземпляр формы.
 * @param folderId - Id папки.
 * ***************************************************************************
 */
export function removeFolderTab(form: Main, folderId: string): void {

    try {

        // Удаляем таб
        form.foldersTabs?.removeTab(folderId);

        // Если папок не осталось — скрываем навигацию папок
        // (остался только таб «Все»)
        const count = form.foldersTabs?.tabLinksElements.length || 0;
        if (count <= 1) {
            form.foldersTabs?.toggleNavigation(true);
        }

    } catch (error) {
        Logger.error("Ошибка при удалении папки", error);
    }

}
