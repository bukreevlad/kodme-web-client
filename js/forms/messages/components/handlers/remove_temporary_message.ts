// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем functions
import { updateStateButtons } from "../../functions/update_state_buttons.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * removeTemporaryMessageHandler - удаление временного (неотправленного)
 * сообщения: снимает его из хранилища формы, сбрасывает ссылку и
 * возвращает кнопки футера в состояние пустого поля.
 * @param message - Родительское сообщение.
 * ***************************************************************************
 */
export async function removeTemporaryMessageHandler(message: MessageItem): Promise<void> {

    try {

        // Удаляем сообщение из Messages.Store
        message.form.store.remove(message.data.id);

        // Сбрасываем временное сообщение
        message.form.tempMessage = null;

        // Черновик больше нет — пересчитываем футер: иначе кнопки записи
        // (голос/видео) останутся скрытыми до следующего ввода текста
        updateStateButtons(message.form);

        // Toast
        Toast.success(window._lc.forms.messages.components.messages.toasts.message_removed, { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
