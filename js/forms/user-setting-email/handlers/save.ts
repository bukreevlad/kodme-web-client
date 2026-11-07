// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Inputs } from "../../../components/inputs.js";

// Импортируем requests
import { saveEmailRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettingEmail } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранение email пользователя: обновление поля в сессии и закрытие формы
 * при успехе, разбор кодов ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function saveHandler(form: UserSettingEmail): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const email = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="email"]`);

    // Поле обязано входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!email) return;

    try {

        // Запрос
        const response = await saveEmailRequest({
            email: email.value.trim().toLowerCase()
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.user_setting_email.toasts.success_save"));

            // Обновляем данные в сессии (без неё обновлять нечего)
            const session = LocalStorage.session;
            if (!session) return;

            // invariant: session.user — объект профиля с сервера, пишем поле
            // email через сужение unknown
            (session.user as Record<string, unknown>).email = email.value.trim().toLowerCase();
            LocalStorage.updateSession(session);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если email не передан
        if (getErrorMessage(error).includes("EMAIL_REQUIRED")) {
            Inputs.markInvalid(email, true);

            // Toast
            Toast.error(t("forms.user_setting_email.toasts.email_required"));
            isToastShown = true;
        }

        // Если email не подходит по формату
        if (getErrorMessage(error).includes("EMAIL_INVALID")) {
            Inputs.markInvalid(email, true);

            // Toast
            Toast.error(t("forms.user_setting_email.toasts.email_invalid"));
            isToastShown = true;
        }

        // Если такой email уже занят
        if (getErrorMessage(error).includes("EMAIL_ALREADY_TAKEN")) {
            Inputs.markInvalid(email, true);

            // Toast
            Toast.error(t("forms.user_setting_email.toasts.email_already_taken"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
