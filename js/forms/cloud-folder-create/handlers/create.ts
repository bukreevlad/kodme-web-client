// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createFolderRequest } from "../../cloud/requests/create_folder.js";

// Импортируем типы
import type { CreateFolderData } from "../../cloud/requests/create_folder.js";
import type { CreateFolder } from "../index.js";
import { Cloud } from "../../cloud/index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Правило имени папки облака (зеркало серверной проверки): буквы любых
 * писменностей, цифры, пробелы, дефисы и подчёркивание — без точек, слэшей
 * и скобок; от 2 до 128 символов.
 */
const FOLDER_NAME_REGEX = /^[\p{L}\p{M}\p{N}\p{Zs}\p{Pd}_]{2,128}$/u;

/**
 * ***************************************************************************
 * Создание папки в текущей папке облака (своё облако либо общий доступ).
 * @param dialog - Экземпляр диалога создания папки.
 * ***************************************************************************
 */
export async function createHandler(dialog: CreateFolder): Promise<void> {

    // Поле ввода имени (читается и в catch — для подсветки ошибки сервера)
    let input = dialog.tpl?.querySelector<HTMLInputElement>(":scope [name='name']");

    try {

        let name = input?.value?.trim() || "";

        // Имя пустое либо не прошло правило — подсвечиваем поле и объясняем
        if (!name || !FOLDER_NAME_REGEX.test(name)) {
            input?.classList.add("invalid");
            input?.focus();
            Toast.error(t("forms.cloud.toasts.invalid_name"));
            return;
        }

        // Убираем подсветку ошибки
        input?.classList.remove("invalid");

        // Форма облака: диалог работает в её контексте
        const cloud = FormsRegistry.getOwner<Cloud>("cloud");
        if (!cloud) return;

        // Определяем режим: общий доступ по ссылке или своё облако
        let shared = cloud.mode === "shared";

        // Текущая папка (для общего доступа корень ссылки — папка самой ссылки)
        let parentId = shared
            ? (cloud.sharedFolderId || cloud.sharedLink?.item?.id || null)
            : cloud.currentFolderId;

        // Формируем данные запроса
        let payload: CreateFolderData = {
            parent_id: parentId,
            name: name
        };

        // Для общего доступа дополнительно передаём id ссылки (нужен доступ write)
        if (shared) {
            payload.link_id = cloud.sharedLink?.id || null;
        }

        // Запрос на создание папки в текущей папке облака
        let response = await createFolderRequest(payload);

        // Если папка создана
        if (response.status && response.data) {

            // Добавляем папку в хранилище текущего режима
            let store = shared ? cloud.sharedStore : cloud.store;
            store.add({ ...response.data, item_type: "folder" });

            // Показываем уведомление
            Toast.success(t("forms.cloud.toasts.folder_created"));

            // Закрываем диалог
            dialog.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // Имя не прошло проверку сервера
        if (message.includes("NAME_INVALID")) {

            // Подсвечиваем поле и объясняем причину
            input?.classList.add("invalid");
            input?.focus();
            Toast.error(t("forms.cloud.toasts.invalid_name"));
            isToastShown = true;

        }

        // Имя уже занято в этой папке
        if (message.includes("NAME_ALREADY_TAKEN")) {
            Toast.error(t("forms.cloud.toasts.folder_name_taken"));
            isToastShown = true;
        }

        // Нет прав на создание (например, закончился доступ по ссылке)
        if (message.includes("ACCESS_DENIED")) {
            Toast.error(t("forms.cloud.toasts.access_denied"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }
    }

}
