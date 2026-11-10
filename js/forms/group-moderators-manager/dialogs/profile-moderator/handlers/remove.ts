// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем handlers
import { removeModeratorHandler } from "../../../handlers/remove_moderator.js";

// Импортируем типы
import { GroupModeratorsManager } from "../../../index.js";
import type { GroupProfileModerator } from "../index.js";

/**
 * ***************************************************************************
 * Удаление модератора из формы его настроек: общий обработчик показывает
 * диалог и запрос, при успехе настройки закрываются.
 * @param form - Форма настроек модератора.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function removeModeratorFromProfileHandler(form: GroupProfileModerator): Promise<void> {

    try {

        // Список модераторов — вкладка, в которой открыты настройки
        const listForm = GroupModeratorsManager.instances.get(form.channelId);
        if (!listForm) return;

        // Диалог подтверждения, запрос и уборка строки — в общем обработчике
        await removeModeratorHandler(listForm, form.userId, () => form.modal?.close());

    } catch (error) {
        Logger.error(error);
    }

}
