// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { saveRequest } from "../requests/save.js";

// Импортируем типы
import type { ChannelSettingLink } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение ссылки канала: чтение поля формы, запрос и закрытие при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function saveHandler(form: ChannelSettingLink): Promise<void> {

    // Устанавливаем элементы
    let link = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);

    try {

        // Запрос
        let response = await saveRequest({
            channel_id: form.channelId,
            link: link?.value ?? ""
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.channel_setting_link.toasts.success_save);

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
            Toast.error(window._lc.forms.channel_setting_link.toasts.link_already_taken);
            isToastShown = true;
        }

        // Если ссылка не подходит по формату
        if (getErrorMessage(error).includes("LINK_INVALID")) {
            link?.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.channel_setting_link.toasts.link_invalid);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
