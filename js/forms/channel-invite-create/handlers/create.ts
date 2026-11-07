// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createRequest } from "../requests/create.js";

// Импортируем типы
import type { ChannelInviteCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание приглашения: чтение полей формы, запрос и закрытие формы при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function createHandler(form: ChannelInviteCreate): Promise<void> {

    // Устанавливаем элементы
    let name = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    let maxUsers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="max-users"]`);

    try {

        // Запрос
        let response = await createRequest({
            channel_id: form.channelId,
            name: name?.value ?? "",
            max_users: Number(maxUsers?.value)
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(t("forms.channel_invite_create.toasts.success_create"));

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Количество участников вне допустимого диапазона
        if (getErrorMessage(error).includes("MAX_USERS_RANGE_INVALID")) {
            maxUsers?.classList.add("invalid");

            // Toast
            Toast.error(t("forms.channel_invite_create.toasts.max_users_range_invalid"));
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("NAME_INVALID")) {
            name?.classList.add("invalid");

            // Toast
            Toast.error(t("forms.channel_invite_create.toasts.name_invalid"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
