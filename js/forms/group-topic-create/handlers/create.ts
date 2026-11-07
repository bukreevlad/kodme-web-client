// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createRequest } from "../requests/create.js";

// Импортируем типы
import type { GroupTopicCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание темы группы: чтение полей формы, запрос и закрытие при успехе.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function createHandler(form: GroupTopicCreate): Promise<void> {

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
        let response = await createRequest({
            group_id: form.channelId,
            name: name.value,
            about: about.value,
            is_public: isPublic.checked,
            is_posting: isPosting.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.group_topic_create.toasts.success_create"));

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Название обязательно
        if (getErrorMessage(error).includes("NAME_REQUIRED")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(t("forms.group_topic_create.toasts.name_required"));
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("INVALID_NAME")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(t("forms.group_topic_create.toasts.invalid_name"));
            isToastShown = true;
        }

        // Описание не подходит по формату
        if (getErrorMessage(error).includes("INVALID_ABOUT")) {
            about.classList.add("invalid");

            // Toast
            Toast.error(t("forms.group_topic_create.toasts.invalid_about"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
