// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeThumbRequest } from "../requests/remove_thumb.js";

// Импортируем типы
import type { MeetSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/** Прозрачная заглушка обложки (как в шаблоне формы до загрузки). */
const THUMB_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * ***************************************************************************
 * Удаление обложки конференции: снимает ссылку на сервере и возвращает
 * картинку формы к прозрачной заглушке.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function removeThumb(form: MeetSettings): Promise<void> {

    try {

        // Запрашиваем удаление на сервере (идемпотентно)
        await removeThumbRequest({ meet_id: form.meetId });

        // Возвращаем обложку к заглушке
        if (form.thumbImage) form.thumbImage.src = THUMB_PLACEHOLDER;

        // Toast
        Toast.success(t("forms.meet_settings.toasts.success_remove_thumb"));

    } catch (error) {
        Logger.error(error);

        // Имя ошибки берём из разбора (формат «ИМЯ :: код»)
        const info = parseError(error);

        // Отказ в доступе — свой текст, остальное — общий фолбэк
        if (info.isAccessDenied) {
            Toast.error(t("forms.meet_settings.toasts.access_denied"));
        } else {
            Toast.error(t("forms.meet_settings.toasts.remove_thumb_error"));
        }
    }

}
