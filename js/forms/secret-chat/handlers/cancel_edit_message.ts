// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Отменить редактирование сообщения: сбросить черновик и состояние кнопок.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function cancelEditMessageHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Сбрасываем редактируемое сообщение
        form.editedMessage = null;

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем отображение кнопок
        await updateStateButtons(form);

    } catch (error) {
        Logger.error(error);
    }

}
