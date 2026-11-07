// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveBotLinkRequest } from "../requests/save.js";

// Импортируем типы
import type { BotSettingLink } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение новой ссылки бота по данным формы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function saveBotLinkHandler(form: BotSettingLink): Promise<void> {

    // Устанавливаем элементы
    const link = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);

    try {

        // Запрос
        const response = await saveBotLinkRequest({
            bot_id: form.botId,
            link: link?.value ?? ""
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.bot_setting_link.toasts.success_save);

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
            Toast.error(window._lc.forms.bot_setting_link.toasts.link_already_taken);
            isToastShown = true;
        }

        // Если ссылка не подходит по формату
        if (getErrorMessage(error).includes("INVALID_LINK")) {
            link?.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.bot_setting_link.toasts.link_invalid);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
