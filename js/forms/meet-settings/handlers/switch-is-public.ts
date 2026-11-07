// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetSettings } from "../index.js";

/**
 * ***************************************************************************
 * Переключение видимости блока приглашений: он показывается только для
 * закрытых конференций.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function switchIsPublicHandler(form: MeetSettings): Promise<void> {

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
