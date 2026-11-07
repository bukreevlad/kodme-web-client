// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

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
    }

}
