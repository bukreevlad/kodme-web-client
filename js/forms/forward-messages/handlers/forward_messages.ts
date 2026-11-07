// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * Пересылка выбранных сообщений: отдаёт id выделенных каналов в callback
 * формы и закрывает её. Без выделенных каналов — тихо выходит.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function forwardMessagesHandler(form: ForwardMessages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Если есть выделенные элементы
        if (form.selectedChannelsIds && form.selectedChannelsIds?.length > 0) {

            // Возвращаем данные в callback
            form.callback?.(form.selectedChannelsIds);

            // Закрываем форму
            form.modal?.close();

        }

    } catch (error) {
        Logger.error(error);
    }

}
