// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createRequest } from "../requests/create.js";

// Импортируем типы
import type { MeetInviteCreate } from "../index.js";

/**
 * ***************************************************************************
 * Создание приглашения: чтение полей формы, запрос и закрытие формы при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function createHandler(form: MeetInviteCreate): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    let name = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    let maxUsers = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="max-users"]`);
    let switchMaxUsers = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-max-users"]`);

    // Поля обязаны входить в шаблон — иначе сохранять и подсвечивать нечего
    if (!name || !maxUsers || !switchMaxUsers) return;

    try {

        // Запрос (выключенный переключатель — без лимита: сервер трактует 0 как «не ограничено»)
        let response = await createRequest({
            meet_id: form.meetId,
            name: name.value,
            max_users: switchMaxUsers.checked ? Number(maxUsers.value) : 0
        });

        // Проверка запроса
        if (response.status) {

            // Toast
            Toast.success(window._lc.forms.meet_invite_create.toasts.success_create);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // Количество участников указано не верно
        if (getErrorMessage(error).includes("INVALID_MAX_USERS")) {
            maxUsers.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.meet_invite_create.toasts.invalid_max_users);
            isToastShown = true;
        }

        // Название не подходит по формату
        if (getErrorMessage(error).includes("INVALID_NAME")) {
            name.classList.add("invalid");

            // Toast
            Toast.error(window._lc.forms.meet_invite_create.toasts.invalid_name);
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
        }

    }

}
