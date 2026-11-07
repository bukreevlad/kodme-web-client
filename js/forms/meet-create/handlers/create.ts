// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createRequest } from "../requests/create.js";

// Импортируем типы
import type { MeetCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание конференции: чтение полей формы, запрос и закрытие формы при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function createHandler(form: MeetCreate): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    let name = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    let about = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="about"]`);
    let isPublic = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
    let isChat = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-chat"]`);

    // Поля обязаны входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!name || !about || !isPublic || !isChat) return;

    try {

        // Запрос
        let response = await createRequest({
            name: name.value,
            about: about.value,
            is_public: isPublic.checked,
            is_chat: isChat.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.meet_create.toasts.success_create"));

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
            Toast.error(t("forms.meet_create.toasts.name_required"));
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("INVALID_NAME")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(t("forms.meet_create.toasts.invalid_name"));
            isToastShown = true;
        }

        // Описание не подходит по формату
        if (getErrorMessage(error).includes("INVALID_DESCRIPTION")) {
            about.classList.add("invalid");

            // Toast
            Toast.error(t("forms.meet_create.toasts.invalid_description"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
