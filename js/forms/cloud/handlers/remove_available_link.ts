// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeAvailableLinkRequest } from "../requests/remove_available_link.js";

// Импортируем типы
import type { CloudAvailableLink } from "../types.js";
import type { Cloud } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление ссылки из «Доступное для меня».
 * @param form - Экземпляр формы.
 * @param linkData - Доступная ссылка (link_id).
 * ***************************************************************************
 */
export async function removeAvailableLinkHandler(form: Cloud, linkData: CloudAvailableLink): Promise<void> {

    try {

        // Запрос на сервер
        let response = await removeAvailableLinkRequest({ link_id: linkData.id });

        // Если ссылка удалена
        if (response.status) {

            // Удаляем элемент из хранилища
            form.availableStore.remove(linkData.id);

            // Показываем уведомление
            Toast.success(t("forms.cloud.toasts.link_removed"));

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // Ссылка уже удалена из списка доступных
        if (message.includes("LINK_NOT_FOUND")) {
            Toast.error(t("forms.cloud.toasts.link_not_valid"));
            isToastShown = true;
        }

        // Нет прав на удаление
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
