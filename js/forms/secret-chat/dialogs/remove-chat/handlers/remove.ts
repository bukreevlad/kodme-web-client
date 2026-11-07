// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем типы
import type { RemoveChat } from "../index.js";

/**
 * ***************************************************************************
 * Отправить ответ диалога удаления чата и закрыть диалог.
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function removeHandler(form: RemoveChat): Promise<void> {

    try {

        // Отправляем ответ
        form.callback();
        form.modal?.close();

    } catch (error) {

        // Если не удалось отправить ответ
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
