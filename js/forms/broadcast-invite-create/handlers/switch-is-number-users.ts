// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastInviteCreate } from "../index.js";

/**
 * ***************************************************************************
 * Переключение блока ввода лимита пользователей: при выключении переключателя
 * поле сбрасывается в 0 (без лимита) и прячется.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function switchIsNumberUsersHandler(form: BroadcastInviteCreate): Promise<void> {

    try {

        // Устанавливаем элементы
        let maxUsersContainer = form.tpl?.querySelector<HTMLElement>(`:scope >.content [data-max-users]`);
        let SwitchMaxUsers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="is-max-users"]`);
        let maxUsers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="max-users"]`);

        // Сбрасываем значение
        if (!SwitchMaxUsers?.checked && maxUsers) maxUsers.value = "0";

        // Переключаем класс
        maxUsersContainer?.classList.toggle("hidden");

    } catch (error) {
        Logger.error(error);
    }

}
