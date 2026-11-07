// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeBotAvatarRequest } from "../requests/remove_avatar.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Удаление аватара бота: снимает ссылку на сервере, обнуляет аватар
 * в данных формы и пересоздаёт компонент (акроним с цветным фоном —
 * переключение setName не красит фон у аватара, собранного с картинкой).
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function removePhoto(form: BotSettings): Promise<void> {

    try {

        // Запрашиваем удаление на сервере (идемпотентно)
        await removeBotAvatarRequest({ bot_id: form.botId });

        // Обновляем данные формы
        if (form.profile) form.profile.avatar = null;

        // Пересоздаём компонент аватара по данным формы
        const avatarElement = form.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        if (avatarElement) {
            form.avatar = new Avatars({
                element: avatarElement,
                id: form.botId,
                name: form.profile?.link ?? null,
                image: null,
                size: "3xl"
            });
        }

        // Toast
        Toast.success(window._lc.forms.bot_settings.toasts.success_remove_avatar);

    } catch (error) {
        Logger.error(error);

        // Имя ошибки берём из разбора (формат «ИМЯ :: код»)
        const info = parseError(error);

        // Отказ в доступе — свой текст, остальное — общий фолбэк
        if (info.isAccessDenied) {
            Toast.error(window._lc.api.errors.access_denied);
        } else {
            Toast.error(window._lc.forms.bot_settings.toasts.remove_avatar_error);
        }
    }

}
