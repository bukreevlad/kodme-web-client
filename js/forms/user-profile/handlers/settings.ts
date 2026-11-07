// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { UserSettings } from "../../user-settings/index.js";

// Импортируем типы
import type { UserProfile } from "../index.js";

/**
 * ***************************************************************************
 * Открытие настроек пользователя из шапки профиля.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function settingsHandler(form: UserProfile): Promise<void> {

    try {

        // Открываем форму
        new UserSettings({ userId: form.userId });

    } catch (error) {
        Logger.error(error);
    }

}
