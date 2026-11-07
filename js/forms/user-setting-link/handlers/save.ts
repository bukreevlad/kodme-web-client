// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveLinkRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettingLink } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение публичной ссылки профиля: обновление поля в сессии и закрытие
 * формы при успехе, разбор кодов ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function saveHandler(form: UserSettingLink): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const link = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);

    // Поле обязано входить в шаблон — иначе сохранять нечего
    if (!link) return;

    try {

        // Запрос
        const response = await saveLinkRequest({
            link: link.value.trim().toLowerCase()
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.user_setting_link.toasts.success_save);

            // Обновляем данные в сессии (без неё обновлять нечего)
            const session = LocalStorage.session;
            if (!session) return;

            // invariant: session.user — объект профиля с сервера, пишем поле
            // link через сужение unknown
            (session.user as Record<string, unknown>).link = link.value.trim().toLowerCase();
            LocalStorage.updateSession(session);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если такая ссылка уже занята
        if (getErrorMessage(error).includes("LINK_ALREADY_TAKEN")) {

            // Toast
            Toast.error(window._lc.forms.user_setting_link.toasts.link_already_taken);
            isToastShown = true;
        }

        // Если ссылка не подходит по формату
        if (getErrorMessage(error).includes("LINK_INVALID")) {
            link.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.user_setting_link.toasts.link_invalid);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
