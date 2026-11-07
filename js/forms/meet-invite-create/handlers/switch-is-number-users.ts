// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetInviteCreate } from "../index.js";

/**
 * ***************************************************************************
 * Переключение видимости поля лимита пользователей: поле показывается только
 * при включённом переключателе «Ограничено».
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function switchIsNumberUsersHandler(form: MeetInviteCreate): Promise<void> {

    try {

        // Устанавливаем элементы
        let maxUsersContainer = form.tpl?.querySelector(`:scope >.content [data-max-users]`);
        let switchMaxUsers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="is-max-users"]`);
        let maxUsers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="max-users"]`);

        // Сбрасываем значение
        if (!switchMaxUsers?.checked && maxUsers) maxUsers.value = "0";

        // Переключаем класс
        maxUsersContainer?.classList.toggle("hidden");

    } catch (error) {
        Logger.error(error);
    }

}
