// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { stripLocalAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Отменить редактирование сообщения: сбросить черновик и состояние кнопок.
 * Неприкреплённые локальные файлы убираются из строки сообщения — иначе
 * они останутся «призраками» до перезагрузки.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function cancelEditMessageHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Сбрасываем редактируемое сообщение (id нужен для чистки файлов)
        const editedId = form.editedMessage?.id;
        form.editedMessage = null;

        // Убираем из строки неприкреплённые локальные файлы
        if (editedId) stripLocalAttaches(form, editedId);

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем отображение кнопок
        await updateStateButtons(form);

    } catch (error) {
        Logger.error(error);
    }

}
