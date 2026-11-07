// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем типы
import type { ExportBotCommands } from "../index.js";

/**
 * ***************************************************************************
 * Копирование JSON-строки меню бота в буфер обмена.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function copyHandler(form: ExportBotCommands): Promise<void> {

    try {

        // Копируем в буфер
        navigator.clipboard.writeText(form.commands)
            .then(() => {
                Toast.success("Текст скопирован", { position: "bottom-center" });
            })
            .catch(err => {
                console.error("Ошибка копирования", err);
            });

    } catch (error) {

        // Если копирование не удалось
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
