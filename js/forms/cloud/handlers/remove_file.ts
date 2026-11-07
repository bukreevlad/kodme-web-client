// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeFileRequest } from "../requests/remove_file.js";

// Импортируем типы
import type { CloudItem } from "../types.js";
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Удаление файла из облака (мягкое удаление, ссылки отзываются).
 * В общем доступе передаётся id ссылки — сервер проверит право записи.
 * @param form - Экземпляр формы.
 * @param data - Файл (данные файла с item_id).
 * ***************************************************************************
 */
export async function removeFileHandler(form: Cloud, data: CloudItem): Promise<void> {

    try {

        // Режим общего доступа (по ссылке)
        let shared = form.mode === "shared";

        // Запрос на сервер
        let response = await removeFileRequest({
            item_id: data.id,
            link_id: shared ? form.sharedLink?.id : null
        });

        // Если файл удалён
        if (response.status) {

            // Удаляем элемент из хранилища соответствующего режима
            let store = shared ? form.sharedStore : form.store;
            store.remove(data.id);

            // Показываем уведомление
            Toast.success(window._lc.forms.cloud.toasts.file_removed);

        } else {

            // Показываем ошибку
            Toast.error(window._lc.forms.cloud.toasts.access_denied);

        }

    } catch (error) {
        Logger.error(error);
    }

}
