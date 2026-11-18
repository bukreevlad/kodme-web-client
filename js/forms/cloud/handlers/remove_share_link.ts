// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeShareLinkRequest } from "../requests/remove_share_link.js";

// Импортируем типы
import type { CloudShareLinkRow } from "../types.js";
import type { Cloud } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отзыв своей ссылки общего доступа.
 * @param form - Экземпляр формы.
 * @param linkData - Ссылка (cloud_share_links).
 * ***************************************************************************
 */
export async function removeShareLinkHandler(form: Cloud, linkData: CloudShareLinkRow): Promise<void> {

    try {

        // Запрос на сервер
        let response = await removeShareLinkRequest({ link_id: linkData.id });

        // Если ссылка отозвана
        if (response.status) {

            // Обновляем список ссылок в открытом диалоге
            let dialog = form.shareLinksDialog;
            if (dialog) {
                dialog._loadLinks();
            }

            // Показываем уведомление
            Toast.success(t("forms.cloud.toasts.link_revoked"));

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // Ссылка уже отозвана/удалена
        if (message.includes("LINK_NOT_FOUND")) {
            Toast.error(t("forms.cloud.toasts.link_not_valid"));
            isToastShown = true;
        }

        // Нет прав на отзыв
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
