// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createMainFolderRequest } from "../requests/create.js";

// Импортируем functions
import { addFolderTab } from "../../main/functions/add_folder_tab.js";

// Импортируем forms
import { MainFoldersManager } from "../../main-folders-manager/index.js";
import { Main } from "../../main/index.js";

// Импортируем типы
import { isRecord } from "../../main/types.js";
import type { MainFolderCreate } from "../index.js";

/**
 * ***************************************************************************
 * Создание папки главного экрана по данным формы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function createMainFolderHandler(form: MainFolderCreate): Promise<void> {

    // Устанавливаем элементы
    const name = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);

    try {

        // Запрос
        const response = await createMainFolderRequest({
            name: name?.value ?? ""
        });

        // Проверка запроса
        if (response.status) {

            // Записываем папку в сессию (данные пользователя в сессии
            // хранятся как unknown — сверяем структуру перед записью)
            const user: unknown = LocalStorage?.session?.user;
            if (isRecord(user) && Array.isArray(user.main_folders)) {
                user.main_folders.push(response.data);
            }

            // Обновляем сессию
            LocalStorage.updateSession(LocalStorage.session);

            // Toast
            Toast.success(window._lc.forms.main_folder_create.toasts.success_create);

            // Закрываем форму
            form.modal?.close();

            // Отображаем новую папку в менеджере папок (если он открыт)
            MainFoldersManager?.instance?.store?.add(response.data);

            // Отображаем новую папку на главной форме (live-синхронизация вкладок)
            if (Main.instance) addFolderTab(Main.instance, response.data);

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если название не прошло валидацию сервера (2-128 символов, только буквы)
        if (getErrorMessage(error).includes("INVALID_NAME")) {

            // Фокусируемся на поле названия
            name?.focus();

            // Toast
            Toast.error(window._lc.forms.main_folder_create.toasts.invalid_name);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
