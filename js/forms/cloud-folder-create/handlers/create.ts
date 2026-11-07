// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createFolderRequest } from "../../cloud/requests/create_folder.js";

// Импортируем типы
import type { CreateFolderData } from "../../cloud/requests/create_folder.js";
import type { CreateFolder } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание папки в текущей папке облака (своё облако либо общий доступ).
 * @param dialog - Экземпляр диалога создания папки.
 * ***************************************************************************
 */
export async function createHandler(dialog: CreateFolder): Promise<void> {

    try {

        // Получаем поле ввода имени
        let input = dialog.tpl?.querySelector<HTMLInputElement>(":scope [name='name']");
        let name = input?.value?.trim() || "";

        // Если имя пустое — подсвечиваем поле
        if (!name) {
            input?.classList.add("invalid");
            input?.focus();
            return;
        }

        // Убираем подсветку ошибки
        input?.classList.remove("invalid");

        // Определяем режим: общий доступ по ссылке или своё облако
        let shared = dialog.form.mode === "shared";

        // Текущая папка (для общего доступа корень ссылки — папка самой ссылки)
        let parentId = shared
            ? (dialog.form.sharedFolderId || dialog.form.sharedLink?.item?.id || null)
            : dialog.form.currentFolderId;

        // Формируем данные запроса
        let payload: CreateFolderData = {
            parent_id: parentId,
            name: name
        };

        // Для общего доступа дополнительно передаём id ссылки (нужен доступ write)
        if (shared) {
            payload.link_id = dialog.form.sharedLink?.id || null;
        }

        // Запрос на создание папки в текущей папке облака
        let response = await createFolderRequest(payload);

        // Если папка создана
        if (response.status && response.data) {

            // Добавляем папку в хранилище текущего режима
            let store = shared ? dialog.form.sharedStore : dialog.form.store;
            store.add({ ...response.data, item_type: "folder" });

            // Показываем уведомление
            Toast.success(t("forms.cloud.toasts.folder_created"));

            // Закрываем диалог
            dialog.modal?.close();

        }

    } catch (error) {
        Logger.error(error);
    }

}
