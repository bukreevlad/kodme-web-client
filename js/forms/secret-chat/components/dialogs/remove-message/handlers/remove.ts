// Импортируем components
import { Toast } from "../../../../../../components/toast.js";

// Импортируем типы
import type { RemoveMessage } from "../index.js";

/**
 * ***************************************************************************
 * Отправить ответ диалога удаления и закрыть диалог.
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function removeHandler(form: RemoveMessage): Promise<void> {

    try {

        // Отправляем ответ
        form.callback?.();
        form.modal?.close();

    } catch (error) {

        // Если не удалось отправить ответ
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
