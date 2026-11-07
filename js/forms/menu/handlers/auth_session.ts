// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем типы
import type { MenuSessionItem } from "../types.js";
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Переключение на выбранную сессию.
 * @param form - Экземпляр формы.
 * @param data - Данные сессии.
 * ***************************************************************************
 */
export function authSessionHandler(form: Menu, data: MenuSessionItem): void {

    try {

        // Сбрасываем последнюю активную сесссию
        LocalStorage.enterSession(data.id);

    } catch (error) {
        Logger.error(error);
    }

}
