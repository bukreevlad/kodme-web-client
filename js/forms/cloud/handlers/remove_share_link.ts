// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeShareLinkRequest } from "../requests/remove_share_link.js";

// Импортируем типы
import type { CloudShareLinkRow } from "../types.js";
import type { Cloud } from "../index.js";

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
            Toast.success(window._lc.forms.cloud.toasts.link_revoked);

        }

    } catch (error) {
        Logger.error(error);
    }

}
