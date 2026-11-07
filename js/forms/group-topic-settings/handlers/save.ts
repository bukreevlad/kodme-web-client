// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveSettingsRequest } from "../requests/save_settings.js";

// Импортируем типы
import type { GroupTopicSettings } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение настроек темы группы: чтение полей формы, запрос и закрытие
 * при успехе.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function saveHandler(form: GroupTopicSettings): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    let name = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    let about = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="about"]`);
    let isPublic = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
    let isPosting = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-posting"]`);

    // Поля обязаны входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!name || !about || !isPublic || !isPosting) return;

    try {

        // Запрос
        let response = await saveSettingsRequest({
            channel_id: form.channelId,
            name: name.value,
            about: about.value,
            is_public: isPublic.checked,
            is_posting: isPosting.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.group_topic_settings.toasts.success_save);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если название не прошло валидацию сервера
        if (getErrorMessage(error).includes("NAME_REQUIRED") || getErrorMessage(error).includes("INVALID_NAME")) {

            // Фокусируемся на поле названия
            name.focus();

            // Toast
            Toast.error(window._lc.forms.group_topic_settings.toasts.invalid_name);
            isToastShown = true;
        }

        // Если описание не прошло валидацию сервера
        if (getErrorMessage(error).includes("INVALID_ABOUT")) {

            // Фокусируемся на поле описания
            about.focus();

            // Toast
            Toast.error(window._lc.forms.group_topic_settings.toasts.invalid_about);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
