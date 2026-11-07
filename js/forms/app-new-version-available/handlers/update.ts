// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { AppNewVersionAvailable } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обработчик обновления приложения: отдаёт ответ вызывающему коду
 * (подтверждение обновления) и закрывает форму.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function updateAppHandler(form: AppNewVersionAvailable): Promise<void> {

    try {

        if (form.callback) {

            // Отправляем ответ
            form.callback(true);

            // Toast
            Toast.warning(t("forms.app_new_version_available.toasts.update_ready"));

        }

    } catch (error) {
        Logger.error(error);
    } finally {
        form.modal?.close();
    }

}
