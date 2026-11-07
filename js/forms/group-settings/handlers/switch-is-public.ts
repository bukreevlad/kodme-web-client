// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { GroupSettings } from "../index.js";

/**
 * ***************************************************************************
 * Переключение видимости блока приглашений: он показывается только для
 * закрытых групп.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function switchIsPublicHandler(form: GroupSettings): Promise<void> {

    try {

        // Устанавливаем элементы
        let switchIsPublic = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
        let invitesContainer = form.tpl?.querySelector(`:scope >.content [data-invites]`);

        // Переключаем класс
        if (switchIsPublic?.checked) {
            invitesContainer?.classList.add("hidden");
        } else {
            invitesContainer?.classList.remove("hidden");
        }

    } catch (error) {
        Logger.error(error);
    }

}
