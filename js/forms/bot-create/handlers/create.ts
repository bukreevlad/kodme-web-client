// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createBotRequest } from "../requests/create.js";

// Импортируем типы
import type { BotCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание бота по данным формы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function createBotHandler(form: BotCreate): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const link = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);
    const bio = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="bio"]`);
    const isPublic = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);

    // Поля обязаны входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!link || !bio || !isPublic) return;

    try {

        // Запрос
        const response = await createBotRequest({
            link: link.value,
            bio: bio.value,
            is_public: isPublic.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.bot_create.toasts.success_create"));

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если ссылка не прошла валидацию сервера
        if (getErrorMessage(error).includes("INVALID_LINK")) {

            // Фокусируемся на поле ссылки
            link.focus();

            // Toast
            Toast.error(t("forms.bot_create.toasts.invalid_link"));
            isToastShown = true;
        }

        // Если описание не прошло валидацию сервера
        if (getErrorMessage(error).includes("INVALID_BIO")) {

            // Фокусируемся на поле описания
            bio.focus();

            // Toast
            Toast.error(t("forms.bot_create.toasts.invalid_bio"));
            isToastShown = true;
        }

        // Если ссылка уже занята
        if (getErrorMessage(error).includes("PUBLIC_NAME_TAKEN")) {

            // Фокусируемся на поле ссылки
            link.focus();

            // Toast
            Toast.error(t("forms.bot_create.toasts.link_taken"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
