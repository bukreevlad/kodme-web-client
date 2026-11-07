// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeAvatarRequest } from "../requests/remove_avatar.js";

// Импортируем типы
import type { GroupTopicSettings } from "../index.js";

/**
 * ***************************************************************************
 * Удаление аватара темы группы: снимает ссылку на сервере и пересоздаёт
 * компонент (акроним с цветным фоном — переключение setName не красит
 * фон у аватара, собранного с картинкой).
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function removePhoto(form: GroupTopicSettings): Promise<void> {

    try {

        // Запрашиваем удаление на сервере (идемпотентно)
        await removeAvatarRequest({ channel_id: form.channelId });

        // Обновляем данные формы
        if (form.settings) form.settings.avatar = null;

        // Пересоздаём компонент аватара по данным формы
        const avatarElement = form.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        const settings = form.settings;
        if (avatarElement && settings) {
            form.avatar = Avatars.create({
                element: avatarElement,
                id: settings.id,
                name: settings.name,
                image: null,
                size: "3xl"
            });
        }

        // Toast
        Toast.success(window._lc.forms.group_topic_settings.toasts.success_remove_avatar);

    } catch (error) {
        Logger.error(error);

        // Имя ошибки берём из разбора (формат «ИМЯ :: код»)
        const info = parseError(error);

        // Отказ в доступе — свой текст, остальное — общий фолбэк
        if (info.isAccessDenied) {
            Toast.error(window._lc.forms.group_topic_settings.toasts.access_denied);
        } else {
            Toast.error(window._lc.forms.group_topic_settings.toasts.remove_avatar_error);
        }
    }

}
