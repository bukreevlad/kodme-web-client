// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeFolderRequest } from "../requests/remove_folder.js";

// Импортируем типы
import type { CloudItem } from "../types.js";
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Удаление папки (вместе со всем содержимым, мягкое удаление).
 * В общем доступе передаётся id ссылки — сервер проверит право записи.
 * @param form - Экземпляр формы.
 * @param data - Папка (cloud_items).
 * ***************************************************************************
 */
export async function removeFolderHandler(form: Cloud, data: CloudItem): Promise<void> {

    try {

        // Режим общего доступа (по ссылке)
        let shared = form.mode === "shared";

        // Запрос на сервер
        let response = await removeFolderRequest({
            item_id: data.id,
            link_id: shared ? form.sharedLink?.id : null
        });

        // Если папка удалена
        if (response.status) {

            // Удаляем элемент из хранилища соответствующего режима
            let store = shared ? form.sharedStore : form.store;
            store.remove(data.id);

            // Показываем уведомление
            Toast.success(window._lc.forms.cloud.toasts.folder_removed);

        } else {

            // Показываем ошибку
            _showRemoveError(response);

        }

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Отображение ошибки удаления (по коду ошибки сервера).
 * @param response - Ответ сервера.
 * ***************************************************************************
 */
function _showRemoveError(response: unknown): void {

    // Код ошибки сервера (легаси-конверт ответа { error: { code } };
    // актуальный сервер отвечает ошибкой через reject — разбор сохранён
    // на случай легаси-ответа)
    let code = _getLegacyErrorCode(response);

    // Папка не найдена
    if (code === "128102") {
        Toast.error(window._lc.forms.cloud.toasts.folder_not_found);
    } else {
        Toast.error(window._lc.forms.cloud.toasts.access_denied);
    }

}

/**
 * Приватный: код ошибки из легаси-конверта ответа { error: { code } }.
 * @param response - Ответ сервера (unknown — сверяемся проверками).
 * @returns Код ошибки либо пустая строка.
 */
function _getLegacyErrorCode(response: unknown): string {

    if (typeof response !== "object" || response === null) return "";
    if (!("error" in response)) return "";

    let error = response.error;
    if (typeof error !== "object" || error === null) return "";
    if (!("code" in error)) return "";

    return typeof error.code === "string" ? error.code : "";

}
