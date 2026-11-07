// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { EditBotCategory } from "../index.js";

/**
 * ***************************************************************************
 * Удаление папки: передаёт сигнал удаления в колбэк формы.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function removeHandler(form: EditBotCategory): Promise<void> {

    try {

        // Отправляем ответ
        form.callback({
            type: "remove"
        });
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
