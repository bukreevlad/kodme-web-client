// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeAvatarRequest } from "../requests/remove_avatar.js";

// Импортируем типы
import type { UserSettings } from "../index.js";
import type { SessionUserFields } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление аватара пользователя: снимает ссылку на сервере, обнуляет
 * аватар в сессии и пересоздаёт компонент (акроним с цветным фоном —
 * переключение setName не красит фон у аватара, собранного с картинкой).
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function removePhoto(form: UserSettings): Promise<void> {

    try {

        // Запрашиваем удаление на сервере (идемпотентно)
        await removeAvatarRequest();

        // Текущая сессия
        const session = LocalStorage.session;

        // invariant: session.user — объект профиля с сервера,
        // пишем поле через сужение unknown
        if (session?.user) {
            (session.user as Record<string, unknown>).avatar = null;
            LocalStorage.updateSession(session);
        }

        // Пересоздаём компонент аватара по данным сессии
        const user = session?.user as SessionUserFields | undefined;
        const avatarElement = form.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        if (avatarElement) {
            form.avatar = new Avatars({
                element: avatarElement,
                id: user?.id ?? null,
                name: user?.display_name ?? null,
                image: null,
                size: "3xl"
            });
        }

        // Toast
        Toast.success(t("forms.user_settings.toasts.success_remove_avatar"));

    } catch (error) {
        Logger.error(error);

        // Имя ошибки берём из разбора (формат «ИМЯ :: код»)
        const info = parseError(error);

        // Отказ в доступе — свой текст, остальное — общий фолбэк
        if (info.isAccessDenied) {
            Toast.error(t("api.errors.access_denied"));
        } else {
            Toast.error(t("forms.user_settings.toasts.remove_avatar_error"));
        }
    }

}
