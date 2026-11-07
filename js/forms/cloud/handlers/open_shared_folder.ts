// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { getFolder } from "../functions/get_folder.js";

// Импортируем типы
import type { CloudFolderRow } from "../types.js";
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Открытие папки в общем доступе (навигация по ссылке).
 * @param form - Экземпляр формы.
 * @param folder - Папка (cloud_items).
 * ***************************************************************************
 */
export async function openSharedFolderHandler(form: Cloud, folder: CloudFolderRow): Promise<void> {

    try {

        // Запоминаем папку в стеке навигации общего доступа
        form.sharedPath.push({ id: folder.id, name: folder.name });

        // Устанавливаем текущую папку
        form.sharedFolderId = folder.id;

        // Загружаем содержимое папки
        await getFolder(form, { shared: true });

        // Обновляем заголовок и пустые состояния
        form._renderHeader();
        form._updateEmptyStates();

    } catch (error) {
        Logger.error(error);
    }

}
