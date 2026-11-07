// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ThemeCreate } from "../../theme-create/index.js";

/**
 * ***************************************************************************
 * Открытие формы создания темы оформления.
 * ***************************************************************************
 */
export async function createHandler(): Promise<void> {

    try {

        // Открываем форму
        new ThemeCreate();

    } catch (error) {
        Logger.error(error);
    }

}
