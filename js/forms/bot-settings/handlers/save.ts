// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveRequest } from "../requests/save.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение настроек бота: описание из формы плюс текущее меню
 * (`bot_commands` профиля) одной командой.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function saveHandler(form: BotSettings): Promise<void> {

    // Устанавливаем элементы
    let bio = form.tpl?.querySelector<HTMLInputElement>(`[name="bio"]`);

    try {

        // Запрос
        let response = await saveRequest({
            bot_id: form.botId,
            bio: bio?.value ?? "",
            commands: JSON.stringify(form.profile?.bot_commands)
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.bot_settings.toasts.success_save);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Если неверное описание
        if (getErrorMessage(error).includes("INVALID_BIO")) {
            bio?.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.bot_settings.toasts.bio_invalid);
            isToastShown = true;
        }

        // Если неверная ссылка кнопки
        if (getErrorMessage(error).includes("INVALID_BUTTON_URL")) {

            // Toast
            Toast.error(window._lc.forms.bot_settings.toasts.button_url_invalid);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
