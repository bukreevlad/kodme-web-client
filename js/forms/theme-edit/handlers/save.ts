// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveThemeRequest } from "../requests/save.js";

// Импортируем типы
import type { ThemeEdit } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение темы оформления: закрытая форма при успехе, разбор кодов
 * ошибок сервера при неудаче.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function saveHandler(form: ThemeEdit): Promise<void> {

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
        const response = await saveThemeRequest({
            theme_id: form.themeId,
            name: name.value,
            style: styles.value,
            is_public: isPublic.checked
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.theme_edit.toasts.success_save);

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
            Toast.error(window._lc.forms.theme_edit.toasts.name_invalid);
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("NAME_INVALID")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.theme_edit.toasts.name_invalid);
            isToastShown = true;
        }

        // Если неверный style
        if (getErrorMessage(error).includes("STYLE_REQUIRED") || getErrorMessage(error).includes("STYLE_INVALID")) {

            // Toast
            Toast.error(window._lc.forms.theme_edit.toasts.error_style);
            isToastShown = true;

        }

        // Баг сервера: при сохранении темы сервер иногда отдаёт обработчик
        // с текстом ошибки "undefined" вместо кода errors. Ловим это отдельно,
        // чтобы ошибка не была «тихой»
        if (getErrorMessage(error).includes("undefined")) {

            // Toast
            Toast.error(window._lc.forms.theme_edit.toasts.error);
            isToastShown = true;

        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
