// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * Закрытие формы пересылки.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function closeHandler(form: ForwardMessages): Promise<void> {

    try {

        if (!form) return;

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
