// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createThemeRequest } from "../requests/create.js";

// Импортируем типы
import type { ThemeCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание темы оформления по данным формы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function themeCreateHandler(form: ThemeCreate): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const name = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    const isPublic = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
    const styles = form.styles;

    // Поля обязаны входить в форму — иначе сохранять и подсвечивать нечего
    if (!name || !isPublic || !styles) return;

    try {

        // Запрос
        const response = await createThemeRequest({
            name: name.value,
            style: styles.value,
            is_public: isPublic.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.theme_create.toasts.success_create"));

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
            Toast.error(t("forms.theme_create.toasts.name_invalid"));
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("NAME_INVALID")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(t("forms.theme_create.toasts.name_invalid"));
            isToastShown = true;
        }

        // Если неверный style
        if (getErrorMessage(error).includes("STYLE_REQUIRED") || getErrorMessage(error).includes("STYLE_INVALID")) {

            // Toast
            Toast.error(t("forms.theme_create.toasts.error_style"));
            isToastShown = true;

        }

        // Баг сервера: при создании темы сервер иногда отдаёт обработчик
        // с текстом ошибки "undefined" вместо кода errors. Ловим это отдельно,
        // чтобы ошибка не была «тихой»
        if (getErrorMessage(error).includes("undefined")) {

            // Toast
            Toast.error(t("forms.theme_create.toasts.error"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
