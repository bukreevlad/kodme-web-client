// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Закрытие просмотрщика медиа.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function closeHandler(form: MediaViewer): Promise<void> {

    try {

        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
