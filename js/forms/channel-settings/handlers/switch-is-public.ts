// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ChannelSettings } from "../index.js";

/**
 * ***************************************************************************
 * Переключение видимости блока приглашений: он показывается только для
 * закрытых каналов.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function switchIsPublicHandler(form: ChannelSettings): Promise<void> {

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
