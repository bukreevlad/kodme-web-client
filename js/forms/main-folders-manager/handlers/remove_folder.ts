// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeFolderRequest } from "../requests/remove_folder.js";

// Импортируем functions
import { removeFolderTab } from "../../main/functions/remove_folder_tab.js";
import { getSessionMainFolders } from "../../main/functions/session_identity.js";

// Импортируем forms
import { MainFoldersManager } from "../index.js";
import { Main } from "../../main/index.js";

// Импортируем типы
import { isRecord } from "../../main/types.js";
import type { MainFoldersManagerFolder } from "../types.js";

/**
 * ***************************************************************************
 * Удаление папки пользователя по подтверждению в диалоге.
 * @param folder - Данные удаляемой папки.
 * ***************************************************************************
 */
export async function removeFolderHandler(folder: MainFoldersManagerFolder): Promise<void> {

    try {

        // Запрос на сервер (ошибки разбираем в catch ниже)
        let response = await removeFolderRequest({ folder_id: folder.id });
        if (response && response.status) {

            // Toast
            Toast.success(window._lc.forms.main_folders_manager.toasts.success_remove);

            // Получаем актуальный массив папок из сессии без удаляемой
            // (данные пользователя в сессии хранятся как unknown —
            // чтение через guard, запись — после сверки структуры)
            const updatedFolders = getSessionMainFolders().filter(f => f.id !== folder.id);

            // Перезаписываем папки в сессии
            const user: unknown = LocalStorage.session?.user;
            if (isRecord(user)) {
                user.main_folders = updatedFolders;
            }

            // Обновляем сессию
            LocalStorage.updateSession(LocalStorage.session);

            // Удаляем папку в менеджере папок
            MainFoldersManager.instance?.store.remove(folder.id);

            // Удаляем папку на главной форме (live-синхронизация вкладок)
            if (Main.instance) removeFolderTab(Main.instance, folder.id);

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если папка не найдена
        if (getErrorMessage(error).includes("FOLDER_NOT_FOUND") || getErrorMessage(error).includes("INVALID_FOLDER_ID") || getErrorMessage(error).includes("FOLDER_ID_REQUIRED")) {

            // Toast
            Toast.error(window._lc.forms.main_folders_manager.toasts.folder_not_found);
            isToastShown = true;
        }

        // Если нет доступа
        if (getErrorMessage(error).includes("ACCESS_DENIED")) {

            // Toast
            Toast.error(window._lc.forms.main_folders_manager.toasts.access_denied);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}