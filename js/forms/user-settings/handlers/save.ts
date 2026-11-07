// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveSettingsRequest } from "../requests/save.js";

// Импортируем типы
import type { UserSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранение настроек пользователя: обновление полей в сессии и закрытие
 * формы при успехе, разбор кодов ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function saveHandler(form: UserSettings): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const firstName = tpl.querySelector<HTMLInputElement>(`[name="first-name"]`);
    const lastName = tpl.querySelector<HTMLInputElement>(`[name="last-name"]`);
    const bio = tpl.querySelector<HTMLInputElement>(`[name="bio"]`);

    // Поля обязаны входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!firstName || !lastName || !bio) return;

    try {

        // Запрос
        const response = await saveSettingsRequest({
            first_name: firstName.value,
            last_name: lastName.value,
            bio: bio.value
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.user_settings.toasts.success_save"));

            // Обновляем данные в сессии (сессии может не быть — тогда
            // просто закрываем форму)
            const session = LocalStorage.session;
            if (session) {

                // invariant: session.user хранит объект профиля с сервера,
                // response.data — обновлённые поля того же профиля; объединяем
                // через сужение unknown, чтобы не потерять остальные поля
                session.user = {
                    ...(session.user as Record<string, unknown>),
                    ...response.data
                }
                LocalStorage.updateSession(session);

            }

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если не передано имя
        if (getErrorMessage(error).includes("FIRST_NAME_REQUIRED")) {
            firstName.classList.add("invalid");

            // Toast
            Toast.error(t("forms.user_settings.toasts.first_name_required"));
            isToastShown = true;
        }

        // Если неверное имя
        if (getErrorMessage(error).includes("FIRST_NAME_INVALID")) {
            firstName.classList.add("invalid");

            // Toast
            Toast.error(t("forms.user_settings.toasts.first_name_invalid"));
            isToastShown = true;
        }

        // Если неверная фамилия
        if (getErrorMessage(error).includes("LAST_NAME_INVALID")) {
            lastName.classList.add("invalid");

            // Toast
            Toast.error(t("forms.user_settings.toasts.last_name_invalid"));
            isToastShown = true;
        }

        // Если неверное описание
        if (getErrorMessage(error).includes("BIO_INVALID")) {
            bio.classList.add("invalid");

            // Toast
            Toast.error(t("forms.user_settings.toasts.bio_invalid"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
